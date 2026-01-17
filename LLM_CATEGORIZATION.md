# LLM-Based Automatic Categorization

## Overview

This feature adds automatic categorization of speech transcriptions using Azure OpenAI Large Language Models. After a speech entry is transcribed, an asynchronous background process analyzes the transcription and automatically assigns it to the appropriate category.

## Features

- **Asynchronous Processing**: Categorization happens in the background without blocking the API response
- **Azure OpenAI Integration**: Uses your existing Azure OpenAI deployment
- **Automatic Category Assignment**: Identifies categories like feed, susu, poti, temperature, weight, general, etc.
- **Graceful Degradation**: System continues to work even if LLM service is unavailable
- **Configurable Workers**: Adjust the number of concurrent categorization workers

## Categories

The system recognizes the following categories:

- **feed**: Feeding related entries (breast milk, formula, bottle, amount, duration)
- **susu**: Urine/pee related entries
- **poti**: Stool/poop related entries  
- **temperature**: Temperature measurements or fever related
- **weight**: Weight measurements
- **general**: General observations, behavior, sleep, crying
- **multiple**: Entry contains information about multiple categories
- **unclear**: Cannot determine the category from the transcription

## Configuration

### Environment Variables

```bash
# Azure OpenAI Configuration (required)
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_KEY=your-azure-openai-key
AZURE_OPENAI_DEPLOYMENT=your-deployment-name  # e.g., gpt-4o-mini
AZURE_OPENAI_API_VERSION=2024-02-15-preview  # default

# Worker Configuration (optional)
CATEGORIZATION_WORKERS=2  # Number of concurrent categorization threads (default: 2)
```

### Installation

1. Install the required dependencies (already included):

```bash
pip install openai instructor
```

Or install from the updated pyproject.toml:

```bash
pip install -e .
```

2. Set your Azure OpenAI configuration in the environment:

```bash
export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com/"
export AZURE_OPENAI_KEY="your-key"
export AZURE_OPENAI_DEPLOYMENT="gpt-4o-mini"
```

Or add them to your `.env` file:

```
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_KEY=your-key
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
```

3. Start the application - categorization will begin automatically:

```bash
python app.py
```

## How It Works

### Workflow

1. **Audio Upload**: User records and uploads audio
2. **Transcription**: Speech-to-text converts audio to text
3. **Database Insert**: Speech entry is created with transcription
4. **Async Trigger**: Categorization task is submitted to background queue
5. **LLM Analysis**: Worker thread sends transcription to LLM
6. **Category Update**: Database is updated with the identified category

### Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│    POST /api/speech_entries         │
│  (Create entry with transcription)  │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│   Insert to ClickHouse              │
│   (transcription + category=NULL)   │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│   Submit to Async Queue             │
│   (Non-blocking, returns to client) │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│   Background Worker Thread          │
│   - Dequeue task                    │
│   - Call LLM API                    │
│   - Parse category                  │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│   Update Database                   │
│   ALTER TABLE ... UPDATE category   │
└─────────────────────────────────────┘
```

### Thread Safety

- Uses Python's `queue.Queue` which is thread-safe
- Each worker thread processes one task at a time
- Database connections are created per-operation and closed properly
- Graceful shutdown on SIGTERM/SIGINT

## API Integration

### Creating Speech Entries with Auto-Categorization

```javascript
// Create a speech entry with transcription
const response = await fetch('/api/speech_entries', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    object_key: 'speech/20260116/speech_abc123.webm',
    transcription: 'Baby had 60ml of formula at 3pm',
    audio_url: '/api/speech/audio/speech_abc123.webm',
    duration_ms: 5000,
    timestamp: new Date().toISOString()
  })
});

// Entry is created immediately, categorization happens in background
// The category field will be updated asynchronously
```

### Manual Transcription with Categorization

```javascript
// Transcribe with auto-categorization
const response = await fetch('/api/speech/transcribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    object_key: 'speech/20260116/speech_abc123.webm',
    entry_id: 12345  // Optional: if provided, triggers categorization
  })
});

// Returns: { object_key: '...', transcript: '...' }
// If entry_id provided, categorization starts in background
```

### Re-transcribe and Re-categorize

```javascript
// Re-transcribe triggers automatic re-categorization
const response = await fetch('/api/speech_entries/12345/retranscribe', {
  method: 'POST'
});

// Returns updated transcription, category updated in background
```

## Monitoring and Debugging

### Logging

The system logs all categorization activity:

```
INFO - LLM categorization service initialized with openai
INFO - Async categorization processor started
INFO - Submitted categorization task for entry 12345
INFO - Processing categorization for entry 12345
INFO - Entry 12345 categorized as: feed
INFO - Updated entry 12345 with category 'feed'
```

### Health Check

Check if categorization is working:

```python
# In your code
if categorization_processor:
    queue_size = categorization_processor.get_queue_size()
    print(f"Pending categorizations: {queue_size}")
```

### Common Issues

1. **Category stays NULL**: 
   - Check if AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY, and AZURE_OPENAI_DEPLOYMENT are set
   - Look for errors in logs
   - Verify network connectivity to Azure OpenAI endpoint
   - Ensure your Azure OpenAI deployment is active

2. **Slow categorization**:
   - Increase CATEGORIZATION_WORKERS
   - Use faster models (e.g., gpt-4o-mini)
   - Check Azure OpenAI API latency
   - Verify you haven't hit rate limits

3. **Wrong categories**:
   - Categories marked as "unclear" may need manual review
   - Improve transcription quality for better categorization
   - Consider adjusting the prompt in `llm_categorization_service.py`

## Cost Considerations

### Azure OpenAI Pricing (approximate)

Costs depend on your Azure OpenAI pricing tier and model:

- **gpt-4o-mini**: ~$0.00015 per transcription (~100 tokens)
- **gpt-4o**: ~$0.0025 per transcription
- **gpt-3.5-turbo**: ~$0.0001 per transcription

**Recommendation**: Use `gpt-4o-mini` for cost-effective categorization while maintaining good accuracy.

## Future Enhancements

- [ ] Extract structured data (e.g., feed amounts, temperatures) from transcriptions
- [ ] Support for batch categorization of existing entries
- [ ] Category confidence scores
- [ ] Manual review queue for "unclear" categories
- [ ] Custom category definitions per user
- [ ] A/B testing different LLM providers
- [ ] Caching for similar transcriptions

## Security Notes

- API keys are read from environment variables only
- Never log or expose API keys
- LLM requests only contain transcription text, no PII
- Database updates use parameterized queries
- Thread-safe operations throughout

## Testing

To test the categorization system:

```bash
# 1. Set up environment
export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com/"
export AZURE_OPENAI_KEY="your-key"
export AZURE_OPENAI_DEPLOYMENT="gpt-4o-mini"

# 2. Run the test script
python test_categorization.py

# 3. Or start the app and create a test entry
python app.py

# 4. Create a test entry via API
curl -X POST http://localhost:5000/api/speech_entries \
  -H "Content-Type: application/json" \
  -d '{
    "object_key": "test.webm",
    "transcription": "Baby drank 80ml of breast milk",
    "timestamp": "'$(date -Iseconds)'"
  }'

# 5. Check logs for categorization
# Should see: "Entry XXX categorized as: feed"

# 6. Verify in database
# Category field should be updated to "feed"
```
