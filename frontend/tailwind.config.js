/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          light: "#4285F4", // Google蓝
          DEFAULT: "#1a73e8",
          dark: "#0b57d0",
        },
        secondary: {
          light: "#f8f9fa", // Google浅灰
          DEFAULT: "#e8eaed",
          dark: "#dadce0",
        },
        accent: {
          light: "#fbbc05", // Google黄
          DEFAULT: "#f9ab00",
          dark: "#f29900",
        },
      },
      fontSize: {
        'xxs': '0.65rem', // 添加更小的字体尺寸
      },
      fontFamily: {
        sans: ["Google Sans", "Roboto", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
} 