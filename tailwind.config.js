module.exports = {
	content: [
		'./imports/**/*.{js,ts,jsx,tsx}',
		'./client/**/*.{js,ts,jsx,tsx,html}',
	],
	theme: {
		extend: {
			fontFamily: {
				display: ['Playfair Display', 'Georgia', 'serif'],
				body: ['DM Sans', 'sans-serif'],
				mono: ['DM Mono', 'monospace'],
			},
			colors: {
				gold: {
					DEFAULT: '#C9A84C',
					light: '#E8C96A',
					dark: '#A07830',
				},
				cinema: {
					950: '#080808',
					900: '#0F0F0F',
					850: '#141414',
					800: '#1A1A1A',
					750: '#202020',
					700: '#2A2A2A',
					600: '#3A3A3A',
					500: '#5A5A5A',
					400: '#888888',
					300: '#AAAAAA',
					200: '#CCCCCC',
					100: '#EEEEEE',
				},
			},
			animation: {
				'fade-in': 'fadeIn 0.4s ease forwards',
				'slide-up': 'slideUp 0.5s ease forwards',
				shimmer: 'shimmer 1.5s infinite',
			},
			keyframes: {
				fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
				slideUp: {
					from: { opacity: 0, transform: 'translateY(20px)' },
					to: { opacity: 1, transform: 'translateY(0)' },
				},
				shimmer: {
					'0%': { backgroundPosition: '-200% 0' },
					'100%': { backgroundPosition: '200% 0' },
				},
			},
		},
	},
	plugins: [],
};
