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
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="flex flex-col justify-center">
            <div className="mb-4 inline-flex w-fit items-center rounded-full border border-slate-300 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur">
              Maintenance Requests
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Submit a maintenance request
            </h1>

            <p className="mt-4 max-w-xl text-lg leading-8 text-slate-600">
              Quickly report an issue for your home or lot. Fill out the form
              and our team will review your request as soon as possible.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur">
                <div className="text-sm font-semibold text-slate-900">
                  Fast submission
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Send a request in less than a minute.
                </p>
              </div>

              <div className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur">
                <div className="text-sm font-semibold text-slate-900">
                  Photo support
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Attach a photo so staff can understand the issue faster.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-xl backdrop-blur sm:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900">
                Maintenance Request
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Please provide as much detail as possible.
              </p>
            </div>

            {!organizationId && (
              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                This form is missing its community link. Please scan the correct QR code.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="name" className="mb-2 block text-sm font-medium text-slate-700">
                  Full Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Enter your name"
                  value={form.name}
                  onChange={updateField}
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div>
                <label htmlFor="phone" className="mb-2 block text-sm font-medium text-slate-700">
                  Phone Number
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="Enter your phone number"
                  value={form.phone}
                  onChange={updateField}
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div>
                <label htmlFor="address" className="mb-2 block text-sm font-medium text-slate-700">
                  Address / Lot Number
                </label>
                <input
                  id="address"
                  name="address"
                  type="text"
                  autoComplete="street-address"
                  placeholder="Enter address or lot number"
                  value={form.address}
                  onChange={updateField}
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div>
                <label htmlFor="category" className="mb-2 block text-sm font-medium text-slate-700">
                  Category
                </label>
                <select
                  id="category"
                  name="category"
                  value={form.category}
                  onChange={updateField}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-300"
                >
                  <option value="">Leave Unselected</option>
                  <option value="General Maintenance">General Maintenance</option>
                  <option value="Plumbing">Plumbing</option>
                  <option value="Electrical">Electrical</option>
                  <option value="HVAC">HVAC</option>
                  <option value="Appliance">Appliance</option>
                  <option value="Roofing">Roofing</option>
                  <option value="Grounds / Exterior">Grounds / Exterior</option>
                  <option value="Pest Control">Pest Control</option>
                  <option value="Safety Concern">Safety Concern</option>
                </select>
              </div>

              <div>
                <label htmlFor="title" className="mb-2 block text-sm font-medium text-slate-700">
                  Issue
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  placeholder="Briefly describe the issue"
                  value={form.title}
                  onChange={updateField}
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div>
                <label htmlFor="details" className="mb-2 block text-sm font-medium text-slate-700">
                  Details
                </label>
                <textarea
                  id="details"
                  name="details"
                  placeholder="Add any details that would help our team understand the issue"
                  value={form.details}
                  onChange={updateField}
                  rows={5}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div>
                <label htmlFor="photo" className="mb-2 block text-sm font-medium text-slate-700">
                  Photo of Issue
                </label>
                <input
                  id="photo"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setPhoto(file)
                  }}
                  className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-slate-800"
                />

                <p className="mt-2 text-xs text-slate-500">
                  Take or upload a photo of the issue. On most phones, this will offer the camera.
                </p>

                {photo && (
                  <p className="mt-2 text-xs text-slate-600">
                    Selected file: {photo.name}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !organizationId}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-base font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>

              {submitStep && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  {submitStep}
                </div>
              )}

              {message && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {message}
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}

              {debugInfo && (
                <div className="break-words rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
                  {debugInfo}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}