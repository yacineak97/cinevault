import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import { MoviesCollection } from '../db/MoviesCollection';
import { useToast } from './Toast';

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
	<div className='flex items-center gap-2 mb-8'>
		<div className='flex items-center gap-0.5'>
			{[1, 2, 3, 4, 5].map((i) => (
				<svg
					key={i}
					className='w-5 h-5'
					fill={i <= rating ? '#C9A84C' : 'none'}
					stroke={i <= rating ? '#C9A84C' : '#3A3A3A'}
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
		</div>
		<span className='font-mono text-sm' style={{ color: '#C9A84C' }}>
			{rating}/5
		</span>
	</div>
);
const MovieHero: React.FC<any> = ({ movie, genreColor }) => (
	<div
		className='relative overflow-hidden'
		style={{
			background: movie.poster
				? undefined
				: `linear-gradient(135deg, ${genreColor}18 0%, #0F0F0F 50%)`,
			borderBottom: '1px solid #1A1A1A',
		}}
	>
		{movie.poster && (
			<div className='absolute inset-0'>
				<img src={movie.poster} alt='' className='w-full h-full object-cover' />
				<div
					className='absolute inset-0'
					style={{
						background:
							'linear-gradient(to right, rgba(9,9,9,0.95) 40%, rgba(9,9,9,0.6) 100%)',
					}}
				/>
			</div>
		)}

		{!movie.poster && (
			<div className='absolute right-0 top-0 bottom-0 items-center pr-12 select-none pointer-events-none hidden lg:flex'>
				<span
					className='text-[12rem] font-black leading-none opacity-5'
					style={{ fontFamily: "'Playfair Display', serif", color: genreColor }}
				>
					{movie.title[0]}
				</span>
			</div>
		)}

		<div className='max-w-4xl mx-auto px-6 py-16 relative z-10'>
			<Link
				to='/'
				className='inline-flex items-center gap-2 text-sm mb-8 transition-colors hover:opacity-80'
				style={{ color: '#888' }}
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
						d='M15 19l-7-7 7-7'
					/>
				</svg>
				Back to catalogue
			</Link>

			<div className='flex items-center gap-3 mb-4'>
				<span
					className='text-xs px-3 py-1 rounded-full font-medium'
					style={{
						background: `${genreColor}22`,
						color: genreColor,
						border: `1px solid ${genreColor}44`,
					}}
				>
					{movie.genre}
				</span>

				{movie.year && (
					<span
						className='text-xs px-3 py-1 rounded-full font-mono'
						style={{
							background: '#1A1A1A',
							color: '#888',
							border: '1px solid #2A2A2A',
						}}
					>
						{movie.year}
					</span>
				)}
			</div>

			<h1
				className='text-4xl md:text-6xl font-black leading-tight mb-3'
				style={{ fontFamily: "'Playfair Display', serif", color: '#EEEEEE' }}
			>
				{movie.title}
			</h1>

			<p className='text-cinema-400 text-lg mb-6'>
				Directed by{' '}
				<span className='font-semibold' style={{ color: '#CCCCCC' }}>
					{movie.author}
				</span>
			</p>

			{movie.rating && <Stars rating={movie.rating} />}
		</div>
	</div>
);

const DetailsPanel: React.FC<any> = ({
	movie,
	username,
	dateFormatted,
	isAdmin,
	onDelete,
}) => (
	<div className='space-y-6'>
		{movie.poster && (
			<div
				className='rounded-xl overflow-hidden'
				style={{ border: '1px solid #2A2A2A' }}
			>
				<img
					src={movie.poster}
					alt={`${movie.title} poster`}
					className='w-full object-cover'
					style={{ maxHeight: '300px' }}
				/>
			</div>
		)}

		<div
			className='rounded-2xl p-6 space-y-4'
			style={{ background: '#141414', border: '1px solid #2A2A2A' }}
		>
			<h3
				className='text-xs font-mono uppercase tracking-widest'
				style={{ color: '#C9A84C' }}
			>
				Details
			</h3>

			<div className='space-y-3'>
				<div>
					<p className='text-xs text-cinema-600 mb-0.5'>Added by</p>
					<div className='flex items-center gap-2'>
						<div
							className='w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold'
							style={{
								background: 'linear-gradient(135deg,#C9A84C,#A07830)',
								color: '#000',
							}}
						>
							{username[0]?.toUpperCase()}
						</div>
						<span className='text-sm text-cinema-200'>{username}</span>
					</div>
				</div>

				<div>
					<p className='text-xs text-cinema-600 mb-0.5'>Added on</p>
					<p className='text-sm text-cinema-200'>{dateFormatted}</p>
				</div>

				{movie.year && (
					<div>
						<p className='text-xs text-cinema-600 mb-0.5'>Release year</p>
						<p className='text-sm font-mono' style={{ color: '#C9A84C' }}>
							{movie.year}
						</p>
					</div>
				)}
			</div>
		</div>

		{isAdmin && (
			<button
				onClick={onDelete}
				className='w-full py-3 rounded-xl text-sm font-medium transition-all duration-200 hover:opacity-80 flex items-center justify-center gap-2'
				style={{
					background: '#DC262615',
					border: '1px solid #DC262633',
					color: '#EF4444',
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
						d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
					/>
				</svg>
				Remove from vault
			</button>
		)}
	</div>
);

export const MovieDetails: React.FC = () => {
	const { _id } = useParams<{ _id: string }>();
	const navigate = useNavigate();
	const { showToast } = useToast();

	const { movie, username, dateFormatted, isLoading, isAdmin } = useTracker(
		() => {
			const movieHandle = Meteor.subscribe('movies');
			const usersHandle = Meteor.subscribe('users');
			const ready = movieHandle.ready() && usersHandle.ready();
			const user = Meteor.user();

			if (!ready || !_id) {
				return {
					movie: null,
					username: '',
					dateFormatted: '',
					isLoading: true,
					isAdmin: false,
				};
			}

			const foundMovie = MoviesCollection.findOne({ _id });
			if (!foundMovie) {
				return {
					movie: null,
					username: '',
					dateFormatted: '',
					isLoading: false,
					isAdmin: false,
				};
			}

			const movieUser = Meteor.users.findOne({ _id: foundMovie.userId });
			const d = new Date(foundMovie.createdAt);

			return {
				movie: foundMovie,
				username: movieUser?.username ?? 'Unknown',
				dateFormatted: d.toLocaleDateString('en-GB', {
					day: 'numeric',
					month: 'long',
					year: 'numeric',
				}),
				isLoading: false,
				isAdmin: user?.username === 'admin',
			};
		},
	);

	const handleDelete = async () => {
		try {
			await Meteor.callAsync('movies.remove', _id);
			showToast('Film removed from vault', 'success');
			navigate('/');
		} catch (err: any) {
			showToast(err.message || 'Failed to delete', 'error');
		}
	};

	if (isLoading) {
		return (
			<div className='max-w-4xl mx-auto px-6 py-20'>
				<div className='skeleton h-10 w-2/3 rounded-xl mb-4' />
				<div className='skeleton h-6 w-1/3 rounded-xl mb-8' />
				<div className='skeleton h-48 w-full rounded-2xl' />
			</div>
		);
	}

	if (!movie) {
		return (
			<div className='max-w-4xl mx-auto px-6 py-20 text-center'>
				<p className='text-6xl mb-4'>🎬</p>
				<h2
					className='text-2xl font-bold mb-2'
					style={{ fontFamily: "'Playfair Display', serif" }}
				>
					Film not found
				</h2>
				<Link to='/' style={{ color: '#C9A84C' }}>
					← Back to catalogue
				</Link>
			</div>
		);
	}

	const genreColor = GENRE_COLORS[movie.genre] || '#C9A84C';

	return (
		<div className='page-enter'>
			<MovieHero movie={movie} genreColor={genreColor} />

			<div className='max-w-4xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-3 gap-10'>
				<div className='lg:col-span-2 space-y-8'>
					<h2
						className='text-xs font-mono uppercase tracking-widest mb-4'
						style={{ color: '#C9A84C' }}
					>
						Synopsis
					</h2>
					<p className='text-cinema-300 leading-relaxed text-base'>
						{movie.description || 'No synopsis available.'}
					</p>
				</div>

				<DetailsPanel
					movie={movie}
					username={username}
					dateFormatted={dateFormatted}
					isAdmin={isAdmin}
					onDelete={handleDelete}
				/>
			</div>
		</div>
	);
};
