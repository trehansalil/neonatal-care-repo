import { useState, useRef, useCallback } from 'react'

export type RecorderState = 'idle' | 'recording' | 'uploading' | 'transcribing' | 'done' | 'error'

interface UseAudioRecorderReturn {
  state: RecorderState
  duration: number
  waveformData: number[]
  error: string | null
  startRecording: () => Promise<void>
  stopRecording: () => void
  reset: () => void
  audioBlob: Blob | null
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [state, setState] = useState<RecorderState>('idle')
  const [duration, setDuration] = useState(0)
  const [waveformData, setWaveformData] = useState<number[]>(new Array(16).fill(0))
  const [error, setError] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)

  const updateWaveform = useCallback(() => {
    if (!analyserRef.current) return
    const data = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(data)
    const bars = 16
    const step = Math.floor(data.length / bars)
    const levels = Array.from({ length: bars }, (_, i) => data[i * step] / 255)
    setWaveformData(levels)
    animFrameRef.current = requestAnimationFrame(updateWaveform)
  }, [])

  const startRecording = useCallback(async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      })

      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        stream.getTracks().forEach((t) => t.stop())
        audioCtx.close()
        if (timerRef.current) clearInterval(timerRef.current)
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
        analyserRef.current = null
      }

      mediaRecorderRef.current = recorder
      recorder.start(250)
      startTimeRef.current = Date.now()
      setState('recording')

      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 500)

      updateWaveform()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to access microphone')
      setState('error')
    }
  }, [updateWaveform])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      setState('uploading')
    }
  }, [])

  const reset = useCallback(() => {
    setState('idle')
    setDuration(0)
    setWaveformData(new Array(16).fill(0))
    setAudioBlob(null)
    setError(null)
  }, [])

  return { state, duration, waveformData, error, startRecording, stopRecording, reset, audioBlob }
}
