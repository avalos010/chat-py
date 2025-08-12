/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./templates/**/*.{html,js}",
    "./src/**/*.{ts,js}",
    "./static/**/*.{js,html}",
  ],
  theme: {
    extend: {
      colors: {
        "raisin-black": "#1e1e24",
        "penn-red": "#92140c",
        "floral-white": "#fff8f0",
        sunset: "#ffcf99",
        "space-cadet": "#111d4a",
      },
    },
  },
  plugins: [],
};
