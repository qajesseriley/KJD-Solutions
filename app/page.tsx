'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type FormState = {
  name: string
  phone: string
  address: string
  title: string
  details: string
  category: string
}

const MAX_FILE_SIZE_MB = 10
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

export default function HomePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200 px-4 py-10" />}>
      <MaintenanceRequestForm />
    </Suspense>
  )
}

function MaintenanceRequestForm() {
  const searchParams = useSearchParams()

  const organizationId =
    searchParams.get('organization_id') || searchParams.get('org') || ''

  const [form, setForm] = useState<FormState>({
    name: '',
    phone: '',
    address: '',
    title: '',
    details: '',
    category: '',
  })

  const [photo, setPhoto] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [debugInfo, setDebugInfo] = useState('')
  const [submitStep, setSubmitStep] = useState('')

  function updateField(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  function normalizeFormValues() {
    return {
      name: form.name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      title: form.title.trim(),
      details: form.details.trim(),
      category: form.category || null,
    }
  }

  function validatePhoto(file: File | null) {
    if (!file) return null

    if (!file.type.startsWith('image/')) {
      return 'The selected file is not an image.'
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `Photo must be smaller than ${MAX_FILE_SIZE_MB} MB.`
    }

    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    setLoading(true)
    setMessage('')
    setError('')
    setDebugInfo('')
    setSubmitStep('Validating form...')

    try {
      const cleaned = normalizeFormValues()

      if (!organizationId) {
        throw new Error('Missing community link. Please scan the correct maintenance QR code.')
      }

      if (!cleaned.name || !cleaned.phone || !cleaned.address || !cleaned.title) {
        throw new Error('Please complete all required fields.')
      }

      const photoValidationError = validatePhoto(photo)
      if (photoValidationError) {
        throw new Error(photoValidationError)
      }

      const requestId = crypto.randomUUID()

      const fullDescription = cleaned.details
        ? `${cleaned.title}\n\n${cleaned.details}`
        : cleaned.title

      let attachmentUrl: string | null = null

      if (photo) {
        setSubmitStep('Uploading photo...')

        const fileExt = photo.name.split('.').pop() || 'jpg'
        const safeFileExt = fileExt.toLowerCase()
        const filePath = `${requestId}/${Date.now()}.${safeFileExt}`

        const { error: uploadError } = await supabase.storage
          .from('request-attachments')
          .upload(filePath, photo, { upsert: true })

        if (uploadError) throw uploadError

        const { data: publicUrlData } = supabase.storage
          .from('request-attachments')
          .getPublicUrl(filePath)

        if (!publicUrlData?.publicUrl) {
          throw new Error('Photo uploaded, but no public URL was returned.')
        }

        attachmentUrl = publicUrlData.publicUrl
      }

      setSubmitStep('Saving maintenance request...')

      const { error: requestError } = await supabase
        .from('maintenance_requests')
        .insert([
          {
            id: requestId,
            organization_id: organizationId,
            resident_name: cleaned.name,
            resident_phone: cleaned.phone,
            phone: cleaned.phone,
            address: cleaned.address,
            maintenance_request: cleaned.title,
            details: cleaned.details || null,
            description: fullDescription,
            status: 'New',
            priority: 'Normal',
            assigned_to: null,
            category: cleaned.category,
            attachment_url: attachmentUrl,
          },
        ])

      if (requestError) throw requestError

      setMessage('Your maintenance request has been submitted successfully.')
      setDebugInfo(`Request ID: ${requestId}`)

      setForm({
        name: '',
        phone: '',
        address: '',
        title: '',
        details: '',
        category: '',
      })

      setPhoto(null)
      setSubmitStep('')
    } catch (err: any) {
      const errorMessage =
        err?.message ||
        err?.error_description ||
        err?.details ||
        'Something went wrong while submitting.'

      setError(errorMessage)

      const extraDebug = [
        err?.code ? `Code: ${err.code}` : '',
        err?.details ? `Details: ${err.details}` : '',
        err?.hint ? `Hint: ${err.hint}` : '',
      ]
        .filter(Boolean)
        .join(' | ')

      setDebugInfo(extraDebug)
      setSubmitStep('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200 px-4 py-10">
      {/* UI untouched */}
    </main>
  )
}