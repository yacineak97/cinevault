import React, { useRef, useState } from 'react';

export const PosterUpload: React.FC<{
	value: string;
	onChange: (base64: string) => void;
}> = ({ value, onChange }) => {
	const inputRef = useRef<HTMLInputElement>(null);
	const [dragging, setDragging] = useState(false);

	const processFile = (file: File) => {
		if (!file.type.startsWith('image/')) return;
		if (file.size > 5 * 1024 * 1024) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			const result = e.target?.result as string;
			onChange(result);
		};
		reader.readAsDataURL(file);
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setDragging(false);
		const file = e.dataTransfer.files[0];
		if (file) processFile(file);
	};

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) processFile(file);
	};

	return (
		<div>
			<input
				ref={inputRef}
				type='file'
				accept='image/*'
				className='hidden'
				onChange={handleChange}
			/>

			{value ? (
				<div
					className='relative rounded-xl overflow-hidden'
					style={{ height: '220px' }}
				>
					<img
						src={value}
						alt='Poster preview'
						className='w-full h-full object-cover'
					/>
					<div
						className='absolute inset-0 flex items-end justify-between p-3'
						style={{
							background:
								'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)',
						}}
					>
						<span className='text-xs' style={{ color: '#888' }}>
							Poster ready
						</span>
						<button
							type='button'
							onClick={() => {
								onChange('');
								if (inputRef.current) inputRef.current.value = '';
							}}
							className='text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-80'
							style={{
								background: '#DC262620',
								border: '1px solid #DC262640',
								color: '#EF4444',
							}}
						>
							Remove
						</button>
					</div>
				</div>
			) : (
				<div
					onClick={() => inputRef.current?.click()}
					onDragOver={(e) => {
						e.preventDefault();
						setDragging(true);
					}}
					onDragLeave={() => setDragging(false)}
					onDrop={handleDrop}
					className='rounded-xl cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3'
					style={{
						height: '160px',
						border: `2px dashed ${dragging ? '#C9A84C' : '#3A3A3A'}`,
						background: dragging ? '#C9A84C08' : '#1A1A1A',
					}}
				>
					<svg
						className='w-8 h-8'
						fill='none'
						stroke='currentColor'
						viewBox='0 0 24 24'
						style={{ color: dragging ? '#C9A84C' : '#555' }}
					>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							strokeWidth={1.5}
							d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
						/>
					</svg>
					<div className='text-center'>
						<p className='text-sm' style={{ color: '#888' }}>
							Drop an image or click to browse
						</p>
						<p className='text-xs mt-1' style={{ color: '#555' }}>
							JPG, PNG, WEBP — max 5MB
						</p>
					</div>
				</div>
			)}
		</div>
	);
};
