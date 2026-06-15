const isVitest = process.env.VITEST === "true" || process.env.VITEST === "1"

let plugins = ["@tailwindcss/postcss"]

if (isVitest) {
  const tailwindcss = (await import("@tailwindcss/postcss")).default
  plugins = [tailwindcss()]
}

const config = { plugins }

export default config
