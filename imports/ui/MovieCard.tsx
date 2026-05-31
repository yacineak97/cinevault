import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Meteor } from 'meteor/meteor';
import { Movie } from '../db/MoviesCollection';
import { useToast } from './Toast';

interface MovieCardProps {
	movie: Movie;
	isAdmin: boolean;
	index?: number;
}

interface DeleteModalProps {
	movie: Movie;
	onConfirm: () => void;
	onCancel: () => void;
	loading: boolean;
}

const GENRE_COLORS: Record<string, string> = {
	Action: '#EF4444',
	Adventure: '#F97316',
	Animation: '#A855F7',
	Comedy: '#EAB308',
	Crime: '#6B7280',
	Documentary: '#14B8A6',
	Drama: '#3B82F6',
	Fantasy: '#8B5CF6',
	Horror: '#DC2626',
	Mystery: '#6366F1',
	Romance: '#EC4899',
	'Sci-Fi': '#06B6D4',
	Thriller: '#F59E0B',
	Western: '#92400E',
};

const Stars: React.FC<{ rating: number }> = ({ rating }) => (
	<div className='flex items-center gap-0.5'>
		{[1, 2, 3, 4, 5].map((i) => (
			<svg
				key={i}
				className='w-3.5 h-3.5'
				fill={i <= rating ? '#C9A84C' : 'none'}
				stroke={i <= rating ? '#C9A84C' : '#5A5A5A'}
				viewBox='0 0 24 24'
			>
				<path
					strokeLinecap='round'
					strokeLinejoin='round'
					strokeWidth={1.5}
					d='M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z'
				/>
			</svg>
		))}
		<span className='ml-1 text-xs font-mono text-cinema-400'>{rating}/5</span>
	</div>
);

const DeleteModal: React.FC<DeleteModalProps> = ({
	movie,
	onConfirm,
	onCancel,
	loading,
}) => (
	<div
		className='fixed inset-0 z-50 flex items-center justify-center p-4'
		style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
		onClick={onCancel}
	>
		<div
			className='relative w-full max-w-sm rounded-2xl p-6 flex flex-col gap-5'
			style={{
				background: '#141414',
				border: '1px solid #2A2A2A',
				boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
				animation: 'slideUp 0.25s ease forwards',
			}}
			onClick={(e) => e.stopPropagation()}
		>
			<div className='flex justify-center'>
				<div
					className='w-14 h-14 rounded-full flex items-center justify-center'
					style={{
						background: 'rgba(220,38,38,0.12)',
						border: '1px solid rgba(220,38,38,0.25)',
					}}
				>
					<svg
						className='w-7 h-7'
						fill='none'
						stroke='#DC2626'
						viewBox='0 0 24 24'
					>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							strokeWidth={1.8}
							d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
						/>
					</svg>
				</div>
			</div>

			<div className='text-center'>
				<h3
					className='text-lg font-bold mb-1'
					style={{ fontFamily: "'Playfair Display', serif", color: '#EEEEEE' }}
				>
					Remove from Vault?
				</h3>

				<p className='text-sm' style={{ color: '#888' }}>
					You're about to remove{' '}
					<span style={{ color: '#C9A84C', fontWeight: 600 }}>
						"{movie.title}"
					</span>{' '}
					from the catalogue. This action cannot be undone.
				</p>
			</div>

			{movie.poster && (
				<div className='flex justify-center'>
					<img
						src={movie.poster}
						alt={movie.title}
						className='h-24 w-16 object-cover rounded-lg'
						style={{ border: '1px solid #2A2A2A', opacity: 0.7 }}
					/>
				</div>
			)}

			<div className='flex gap-3 mt-1'>
				<button
					onClick={onCancel}
					disabled={loading}
					className='flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:opacity-80'
					style={{
						background: '#1E1E1E',
						border: '1px solid #3A3A3A',
						color: '#AAAAAA',
					}}
				>
					Cancel
				</button>

				<button
					onClick={onConfirm}
					disabled={loading}
					className='flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90 disabled:opacity-50'
					style={{
						background: 'linear-gradient(135deg, #DC2626, #991B1B)',
						color: '#fff',
					}}
				>
					{loading ? (
						<span className='flex items-center justify-center gap-2'>
							<svg
								className='animate-spin w-4 h-4'
								fill='none'
								viewBox='0 0 24 24'
							>
								<circle
									className='opacity-25'
									cx='12'
									cy='12'
									r='10'
									stroke='currentColor'
									strokeWidth='4'
								/>
								<path
									className='opacity-75'
									fill='currentColor'
									d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z'
								/>
							</svg>
							Removing...
						</span>
					) : (
						'Yes, Remove'
					)}
				</button>
			</div>
		</div>
	</div>
);

export const MovieCard: React.FC<MovieCardProps> = ({
	movie,
	isAdmin,
	index = 0,
}) => {
	const navigate = useNavigate();
	const { showToast } = useToast();

	const [showModal, setShowModal] = useState(false);
	const [deleting, setDeleting] = useState(false);

	const handleDeleteClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		setShowModal(true);
	};

	const handleConfirm = async () => {
		setDeleting(true);
		try {
			await Meteor.callAsync('movies.remove', movie._id);
			showToast(`"${movie.title}" removed from vault`, 'success');
			setShowModal(false);
		} catch (err: any) {
			showToast(err.message || 'Failed to delete', 'error');
		} finally {
			setDeleting(false);
		}
	};

	const genreColor = GENRE_COLORS[movie.genre] || '#C9A84C';

	return (
		<>
			{showModal &&
				createPortal(
					<DeleteModal
						movie={movie}
						onConfirm={handleConfirm}
						onCancel={() => setShowModal(false)}
						loading={deleting}
					/>,
					document.body,
				)}

			<div
				onClick={() => navigate(`/movie-details/${movie._id}`)}
				className='group relative flex flex-col rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1'
				style={{
					background: '#141414',
					border: '1px solid #2A2A2A',
					boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
					animationDelay: `${index * 60}ms`,
					animation: 'slideUp 0.4s ease forwards',
					opacity: 0,
				}}
			>
				{isAdmin && (
					<button
						onClick={handleDeleteClick}
						className='absolute top-2 right-2 z-20 w-8 h-8 rounded-full flex items-center justify-center
                       opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 active:scale-95'
						style={{
							background: 'rgba(220,38,38,0.85)',
							border: '1px solid rgba(220,38,38,0.5)',
							backdropFilter: 'blur(4px)',
							boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
						}}
						title='Remove film'
					>
						<svg
							className='w-3.5 h-3.5'
							fill='none'
							stroke='white'
							viewBox='0 0 24 24'
						>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2.5}
								d='M6 18L18 6M6 6l12 12'
							/>
						</svg>
					</button>
				)}

				<div
					className='relative h-52 overflow-hidden'
					style={{
						background: movie.poster
							? undefined
							: `linear-gradient(135deg, ${genreColor}22, #0F0F0F 60%)`,
					}}
				>
					{movie.poster ? (
						<img
							src={movie.poster}
							alt={`${movie.title} poster`}
							className='w-full h-full object-cover transition-transform duration-500 group-hover:scale-105'
						/>
					) : (
						<div className='absolute inset-0 flex items-center justify-center opacity-10 group-hover:opacity-20 transition-opacity duration-300'>
							<svg
								className='w-24 h-24'
								fill='currentColor'
								viewBox='0 0 24 24'
								style={{ color: genreColor }}
							>
								<path d='M18 3a3 3 0 00-3 3v12a3 3 0 003 3 3 3 0 003-3 3 3 0 00-3-3H6a3 3 0 00-3 3 3 3 0 003 3 3 3 0 003-3V6a3 3 0 00-3-3 3 3 0 00-3 3 3 3 0 003 3h12a3 3 0 003-3 3 3 0 00-3-3z' />
							</svg>
						</div>
					)}

					{movie.year && (
						<div
							className='absolute top-3 left-3 text-xs font-mono px-2 py-1 rounded'
							style={{ background: 'rgba(0,0,0,0.7)', color: '#888' }}
						>
							{movie.year}
						</div>
					)}

					<div className='absolute bottom-3 left-3'>
						<span
							className='text-xs px-2 py-1 rounded-md font-medium'
							style={{
								background: `${genreColor}22`,
								color: genreColor,
								border: `1px solid ${genreColor}44`,
							}}
						>
							{movie.genre}
						</span>
					</div>

					<div
						className='absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none'
						style={{
							background:
								'linear-gradient(to top, #141414 0%, transparent 60%)',
						}}
					/>
				</div>

				<div className='flex flex-col flex-1 p-4 gap-2'>
					<h3
						className='font-bold leading-snug line-clamp-2 group-hover:text-gold transition-colors duration-200'
						style={{
							fontFamily: "'Playfair Display', serif",
							fontSize: '1rem',
							color: '#EEEEEE',
						}}
					>
						{movie.title}
					</h3>

					<p className='text-xs text-cinema-500'>
						Directed by <span className='text-cinema-300'>{movie.author}</span>
					</p>

					{movie.rating && <Stars rating={movie.rating} />}

					{movie.description && (
						<p className='text-xs text-cinema-500 line-clamp-2 mt-1 leading-relaxed'>
							{movie.description}
						</p>
					)}

					<div className='mt-auto pt-3 flex items-center justify-between border-t border-cinema-700'>
						<span className='text-xs text-cinema-600'>
							{new Date(movie.createdAt).toLocaleDateString('en-GB', {
								day: 'numeric',
								month: 'short',
								year: 'numeric',
							})}
						</span>

						<span
							className='text-xs font-medium flex items-center gap-1'
							style={{ color: '#C9A84C' }}
						>
							View
							<svg
								className='w-3 h-3'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'
							>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M9 5l7 7-7 7'
								/>
							</svg>
						</span>
					</div>
				</div>
			</div>
		</>
	);
};
