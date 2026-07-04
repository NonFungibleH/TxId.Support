// Renders a JSON-LD structured-data block. Kept as a tiny component so pages
// can drop in one or more schemas without repeating the script boilerplate.
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
