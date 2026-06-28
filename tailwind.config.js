/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        app: '#0c1016',
        card: '#11161f',
        cardHover: '#161c27',
        navActive: '#1c2230',
        input: '#0c1016',
        rowHover: 'rgba(255,255,255,.04)',
        borderSubtle: 'rgba(255,255,255,.05)',
        borderCard: 'rgba(255,255,255,.06)',
        borderInput: 'rgba(255,255,255,.08)',
        textPrimary: '#f3f5fa',
        textSecondary: '#e9edf4',
        textTertiary: '#c4cad6',
        textMuted: '#8b93a5',
        textDim: '#7b8398',
        textDisabled: '#6c7488',
        accentPrimary: '#3770f0',
        accentPrimaryDark: '#174dcc',
        accentBlueLight: '#5580f8',
        accentGreen: '#5fd08a',
        accentGreenMid: '#3ec98a',
        accentGreenDark: '#2bb673',
        accentPurple: '#9b6bff',
        accentOrange: '#f0915a',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'primary-gradient': 'linear-gradient(90deg,#174dcc,#3770f0)',
        'page-bg': 'linear-gradient(160deg,#d9dde8,#c8cfdd)',
      },
      boxShadow: {
        shell: '0 40px 90px -20px rgba(20,28,50,.45)',
        btnGlow: '0 8px 24px -8px rgba(63,111,224,.6)',
        composer: '0 10px 30px -12px rgba(63,111,224,.35)',
      },
    },
  },
  plugins: [],
}
