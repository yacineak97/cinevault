import React from 'react';
import { Link } from 'react-router-dom';

export const NotFound: React.FC = () => {
	return (
		<div
			className='min-h-[calc(100vh-64px)] flex items-center justify-center px-6'
			style={{
				background:
					'radial-gradient(ellipse at 50% 50%, #C9A84C08 0%, transparent 70%)',
			}}
		>
			<div className='text-center max-w-md'>
				<p
					className='text-xs tracking-widest uppercase font-mono mb-6'
					style={{ color: '#C9A84C' }}
				>
					Error 404
				</p>

				<h1
					className='text-8xl font-black mb-4'
					style={{
						fontFamily: "'Playfair Display', serif",
						color: '#EEEEEE',
						lineHeight: 1,
					}}
				>
					404
				</h1>

				<p
					className='text-xl font-semibold mb-3'
					style={{
						fontFamily: "'Playfair Display', serif",
						color: '#CCCCCC',
					}}
				>
					Scene not found
				</p>

				<p className='text-cinema-500 text-sm mb-10 leading-relaxed'>
					The page you're looking for has been cut from the final edit.
				</p>

				<Link
					to='/'
					className='inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-sm transition-all duration-200 hover:opacity-90 hover:scale-105'
					style={{
						background: 'linear-gradient(135deg,#C9A84C,#A07830)',
						color: '#000',
					}}
				>
					<svg
						className='w-4 h-4'
						fill='none'
						stroke='currentColor'
						viewBox='0 0 24 24'
					>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							strokeWidth={2}
							d='M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
						/>
					</svg>
					Back to CineVault
				</Link>
			</div>
		</div>
	);
};
