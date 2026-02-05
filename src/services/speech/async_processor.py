"""Asynchronous background task processor for LLM categorization."""

import threading
import queue
from typing import Optional, Callable
from src.log import get_logger


logger = get_logger(__name__)


class AsyncSpeechProcessor:
    """Background processor that handles transcription, LLM categorization and mapping tasks asynchronously."""
    
    def __init__(self, categorization_service, mapping_service, stt_service, max_workers: int = 2):
        """Initialize the async processor.
        
        Args:
            categorization_service: Instance of CategorizationService
            mapping_service: Instance of EntryMappingService (optional)
            stt_service: Instance of STTService for transcription (optional)
            max_workers: Number of worker threads to process tasks
        """
        from .llm.categorization_service import CategorizationService
        from .llm.entry_mapping_service import EntryMappingService
        from ..stt_service import STTService
        self.categorization_service: CategorizationService = categorization_service
        self.mapping_service: EntryMappingService = mapping_service
        self.stt_service: STTService = stt_service
        self.max_workers = max_workers
        self.task_queue = queue.Queue()
        self.workers = []
        self.running = False
        
    def start(self):
        """Start the background worker threads."""
        if self.running:
            logger.warning("Async processor already running")
            return
            
        self.running = True
        for i in range(self.max_workers):
            worker = threading.Thread(
                target=self._worker_loop,
                name=f"LLM-Categorization-Worker-{i}",
                daemon=True
            )
            worker.start()
            self.workers.append(worker)
            
        logger.info(f"Started {self.max_workers} categorization worker threads")
    
    def stop(self, timeout: int = 10):
        """Stop the background workers gracefully."""
        if not self.running:
            return
            
        logger.info("Stopping categorization workers...")
        self.running = False
        
        # Send stop signals to all workers
        for _ in range(self.max_workers):
            self.task_queue.put(None)
        
        # Wait for workers to finish
        for worker in self.workers:
            worker.join(timeout=timeout)
            
        self.workers.clear()
        logger.info("All categorization workers stopped")
    
    def _worker_loop(self):
        """Main worker loop that processes tasks from the queue."""
        worker_name = threading.current_thread().name
        logger.info(f"{worker_name} started")
        
        while self.running:
            try:
                # Get task from queue (blocks until available)
                task = self.task_queue.get(timeout=1)
                
                # None signals worker to stop
                if task is None:
                    break
                
                # Process the task
                self._process_task(task)
                
            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"{worker_name} error: {e}", exc_info=True)
            finally:
                try:
                    self.task_queue.task_done()
                except ValueError:
                    pass
        
        logger.info(f"{worker_name} stopped")
    
    def _process_task(self, task: dict):
        """Process a single transcription, categorization and mapping task.
        
        Args:
            task: Dictionary containing:
                - task_type: 'transcribe' or 'categorize'
                - entry_id: The speech entry ID
                - object_key: Audio object key (for transcription)
                - transcription: The transcription text (for categorization)
                - callback: Function to call with results
                - mapping_callback: Function to call with mapping results (optional)
                - enable_mapping: Whether to perform entry mapping (default: True)
        """
        task_type = task.get('task_type', 'categorize')
        entry_id = task.get('entry_id')
        
        try:
            if task_type == 'transcribe':
                self._process_transcription_task(task)
            elif task_type == 'categorize':
                self._process_categorization_task(task)
            else:
                logger.error(f"Unknown task type: {task_type}")
        except Exception as e:
            logger.error(f"Error processing {task_type} task for entry {entry_id}: {e}", exc_info=True)
    
    def _process_transcription_task(self, task: dict):
        """Process a transcription task.
        
        Args:
            task: Dictionary containing entry_id, object_key, and callback
        """
        entry_id = task.get('entry_id')
        object_key = task.get('object_key')
        bucket_name = task.get('bucket_name')
        callback = task.get('callback')
        
        logger.info(f"Processing transcription for entry {entry_id}")
        
        if not self.stt_service:
            logger.error(f"STT service not available for entry {entry_id}")
            if callback:
                callback({
                    'entry_id': entry_id,
                    'transcription': '',
                    'error': 'STT service not configured'
                })
            return
        
        try:
            # Perform transcription
            transcription = self.stt_service.transcribe_object(object_key=object_key)
            
            logger.info(f"Entry {entry_id} transcribed: {len(transcription)} chars")
            
            # Call the callback with transcription result
            if callback:
                callback({
                    'entry_id': entry_id,
                    'transcription': transcription
                })
                
        except Exception as e:
            logger.error(f"Error transcribing entry {entry_id}: {e}", exc_info=True)
            if callback:
                callback({
                    'entry_id': entry_id,
                    'transcription': '',
                    'error': str(e)
                })
    
    def _process_categorization_task(self, task: dict):
        """Process a categorization and mapping task.
        
        Args:
            task: Dictionary containing entry_id, transcription, callback, and mapping_callback
        """
        entry_id = task.get('entry_id')
        transcription: str = task.get('transcription', "")
        callback = task.get('callback')
        mapping_callback = task.get('mapping_callback')
        enable_mapping = task.get('enable_mapping', True)
        
        logger.info(f"Processing categorization for entry {entry_id}")
        
        try:
            # Check if LLM service is available
            if not self.categorization_service.is_available():
                logger.warning(f"LLM service not available for entry {entry_id}")
                result = {
                    'entry_id': entry_id,
                    'category': 'unclear',
                    'error': 'LLM service not configured'
                }
            else:
                # Perform categorization
                categorization_result = self.categorization_service.categorize(transcription)
                result = {
                    'entry_id': entry_id,
                    'category': categorization_result.get('category', 'unclear'),
                    "log_date": categorization_result.get('log_date'),
                    "log_time": categorization_result.get('log_time'),
                    'metadata': categorization_result
                }
                
            logger.info(f"Entry {entry_id} categorized as: {result['category']} at {result.get('log_date')}, {result.get('log_time')}")
            
            # Call the callback with categorization results
            if callback:
                callback(result)
            
            # Perform entry mapping if enabled and mapping service is available
            if enable_mapping and self.mapping_service and self.mapping_service.is_available():
                category = result.get('category', 'unclear')
                
                # Only map if category is clear and mappable
                if category not in ['unclear']:
                    logger.info(f"Processing entry mapping for entry {entry_id} (category: {category})")
                    try:
                        mapping_result = self.mapping_service.map_to_entry(transcription, category)
                        mapping_data = {
                            'entry_id': entry_id,
                            'category': category,
                            'mapped_fields': mapping_result,
                            'transcription': transcription
                        }
                        
                        logger.info(f"Entry {entry_id} mapped: {mapping_result}")
                        
                        # Call the mapping callback with results
                        if mapping_callback:
                            mapping_callback(mapping_data)
                    except Exception as map_err:
                        logger.error(f"Error mapping entry {entry_id}: {map_err}", exc_info=True)
                        if mapping_callback:
                            mapping_callback({
                                'entry_id': entry_id,
                                'category': category,
                                'error': str(map_err),
                                'transcription': transcription
                            })
                else:
                    logger.info(f"Skipping mapping for entry {entry_id} - category '{category}' not mappable")
            elif enable_mapping:
                logger.debug(f"Entry mapping not available or not configured for entry {entry_id}")
                
        except Exception as e:
            logger.error(f"Error categorizing entry {entry_id}: {e}", exc_info=True)
            if callback:
                callback({
                    'entry_id': entry_id,
                    'category': 'unclear',
                    'error': str(e)
                })
    
    def submit_task(self, entry_id: int, object_key: str, transcription: str, 
                   callback: Optional[Callable] = None, 
                   mapping_callback: Optional[Callable] = None,
                   enable_mapping: bool = True):
        """Submit a categorization and mapping task to the queue.
        
        Args:
            entry_id: The speech entry ID to categorize
            object_key: The audio object key
            transcription: The transcription text to categorize
            callback: Optional callback function(result: dict) to call with categorization results
            mapping_callback: Optional callback function(result: dict) to call with mapping results
            enable_mapping: Whether to perform entry mapping (default: True)
        """
        if not self.running:
            logger.warning("Cannot submit task, processor not running")
            return False
            
        task = {
            'task_type': 'categorize',
            'entry_id': entry_id,
            'object_key': object_key,
            'transcription': transcription,
            'callback': callback,
            'mapping_callback': mapping_callback,
            'enable_mapping': enable_mapping
        }
        
        self.task_queue.put(task)
        logger.info(f"Submitted categorization task for entry {entry_id} (mapping: {enable_mapping})")
        return True
    
    def submit_transcription_task(self, entry_id: int, object_key: str, bucket_name: str,
                                 callback: Optional[Callable] = None):
        """Submit a transcription task to the queue.
        
        Args:
            entry_id: The speech entry ID to transcribe
            object_key: The audio object key in S3
            bucket_name: The S3 bucket name
            callback: Optional callback function(result: dict) to call with transcription results
        
        Returns:
            bool: True if task was submitted successfully
        """
        if not self.running:
            logger.warning("Cannot submit transcription task, processor not running")
            return False
        
        if not self.stt_service:
            logger.error("Cannot submit transcription task, STT service not configured")
            return False
        
        task = {
            'task_type': 'transcribe',
            'entry_id': entry_id,
            'object_key': object_key,
            'bucket_name': bucket_name,
            'callback': callback
        }
        
        self.task_queue.put(task)
        logger.info(f"Submitted transcription task for entry {entry_id}")
        return True
    
    def get_queue_size(self) -> int:
        """Get the current number of pending tasks."""
        return self.task_queue.qsize()
