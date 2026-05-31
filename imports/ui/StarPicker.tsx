import React, { useState } from 'react';

export const StarPicker: React.FC<{
	value: number;
	onChange: (v: number) => void;
}> = ({ value, onChange }) => {
	const [hovered, setHovered] = useState(0);

	return (
		<div className='flex items-center gap-1'>
			{[1, 2, 3, 4, 5].map((i) => (
				<button
					key={i}
					type='button'
					onMouseEnter={() => setHovered(i)}
					onMouseLeave={() => setHovered(0)}
					onClick={() => onChange(i)}
					className='transition-transform hover:scale-110 focus:outline-none'
				>
					<svg
						className='w-7 h-7'
						fill={(hovered || value) >= i ? '#C9A84C' : 'none'}
						stroke={(hovered || value) >= i ? '#C9A84C' : '#5A5A5A'}
						viewBox='0 0 24 24'
					>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							strokeWidth={1.5}
							d='M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z'
						/>
					</svg>
				</button>
			))}
			{value > 0 && (
				<span className='ml-2 text-sm font-mono' style={{ color: '#C9A84C' }}>
					{value}/5
				</span>
			)}
		</div>
	);
};
