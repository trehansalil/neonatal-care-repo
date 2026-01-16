"""Asynchronous background task processor for LLM categorization."""

import threading
import queue
import time
from typing import Optional, Callable
from ..log import get_logger

logger = get_logger(__name__)


class AsyncCategorizationProcessor:
    """Background processor that handles LLM categorization tasks asynchronously."""
    
    def __init__(self, llm_service, max_workers: int = 2):
        """Initialize the async processor.
        
        Args:
            llm_service: Instance of LLMCategorizationService
            max_workers: Number of worker threads to process tasks
        """
        self.llm_service = llm_service
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
        """Process a single categorization task.
        
        Args:
            task: Dictionary containing:
                - entry_id: The speech entry ID
                - object_key: Audio object key
                - transcription: The transcription text
                - callback: Function to call with results
        """
        entry_id = task.get('entry_id')
        transcription = task.get('transcription')
        callback = task.get('callback')
        
        logger.info(f"Processing categorization for entry {entry_id}")
        
        try:
            # Check if LLM service is available
            if not self.llm_service.is_available():
                logger.warning(f"LLM service not available for entry {entry_id}")
                result = {
                    'entry_id': entry_id,
                    'category': 'unclear',
                    'error': 'LLM service not configured'
                }
            else:
                # Perform categorization
                categorization_result = self.llm_service.categorize(transcription)
                result = {
                    'entry_id': entry_id,
                    'category': categorization_result.get('category', 'unclear'),
                    'metadata': categorization_result
                }
                
            logger.info(f"Entry {entry_id} categorized as: {result['category']}")
            
            # Call the callback with results
            if callback:
                callback(result)
                
        except Exception as e:
            logger.error(f"Error categorizing entry {entry_id}: {e}", exc_info=True)
            if callback:
                callback({
                    'entry_id': entry_id,
                    'category': 'unclear',
                    'error': str(e)
                })
    
    def submit_task(self, entry_id: int, object_key: str, transcription: str, 
                   callback: Optional[Callable] = None):
        """Submit a categorization task to the queue.
        
        Args:
            entry_id: The speech entry ID to categorize
            object_key: The audio object key
            transcription: The transcription text to categorize
            callback: Optional callback function(result: dict) to call when done
        """
        if not self.running:
            logger.warning("Cannot submit task, processor not running")
            return False
            
        task = {
            'entry_id': entry_id,
            'object_key': object_key,
            'transcription': transcription,
            'callback': callback
        }
        
        self.task_queue.put(task)
        logger.info(f"Submitted categorization task for entry {entry_id}")
        return True
    
    def get_queue_size(self) -> int:
        """Get the current number of pending tasks."""
        return self.task_queue.qsize()
