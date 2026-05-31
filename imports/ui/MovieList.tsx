import React, { useState, useMemo } from 'react';
import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import { Link } from 'react-router-dom';
import { MoviesCollection, GENRES, Genre } from '../db/MoviesCollection';
import { MovieCard } from './MovieCard';

const SkeletonCard: React.FC = () => (
	<div
		className='rounded-xl overflow-hidden'
		style={{ background: '#1A1A1A', border: '1px solid #2A2A2A' }}
	>
		<div className='skeleton h-48 w-full' />
		<div className='p-4 space-y-3'>
			<div className='skeleton h-5 w-3/4 rounded' />
			<div className='skeleton h-4 w-1/2 rounded' />
			<div className='skeleton h-4 w-full rounded' />
			<div className='flex gap-2 mt-2'>
				<div className='skeleton h-6 w-16 rounded-full' />
				<div className='skeleton h-6 w-20 rounded-full' />
			</div>
		</div>
	</div>
);

const Header = ({ movies, isAdmin }: any) => (
	<div className='flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10'>
		<div>
			<p
				className='text-xs tracking-widest uppercase font-mono mb-2'
				style={{ color: '#C9A84C' }}
			>
				— Your collection
			</p>

			<h1
				className='text-4xl md:text-5xl font-bold leading-tight'
				style={{ fontFamily: "'Playfair Display', serif", color: '#EEEEEE' }}
			>
				Film Catalogue
			</h1>

			<p className='text-cinema-400 mt-2 text-sm'>
				{movies.length} film{movies.length !== 1 ? 's' : ''} in the vault
			</p>
		</div>

		{isAdmin && (
			<Link
				to='/addmovie'
				className='flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:opacity-90 hover:scale-105 shrink-0'
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
						strokeWidth={2.5}
						d='M12 4v16m8-8H4'
					/>
				</svg>
				Add Film
			</Link>
		)}
	</div>
);

const Filters = ({
	search,
	setSearch,
	selectedGenre,
	setSelectedGenre,
	sortBy,
	setSortBy,
}: any) => (
	<>
		<div className='flex flex-col md:flex-row gap-3 mb-8'>
			<div className='relative flex-1'>
				<svg
					className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cinema-500'
					fill='none'
					stroke='currentColor'
					viewBox='0 0 24 24'
				>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
					/>
				</svg>

				<input
					type='text'
					placeholder='Search by title or director...'
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className='cv-input w-full pl-10 pr-4 py-3 rounded-xl text-sm text-cinema-100 placeholder-cinema-500 transition-all duration-200'
					style={{ background: '#1A1A1A', border: '1px solid #3A3A3A' }}
				/>
			</div>

			<select
				value={selectedGenre}
				onChange={(e) => setSelectedGenre(e.target.value as any)}
				className='cv-input px-4 py-3 rounded-xl text-sm text-cinema-200 appearance-none cursor-pointer'
				style={{
					background: '#1A1A1A',
					border: '1px solid #3A3A3A',
					minWidth: 140,
				}}
			>
				<option value='All'>All Genres</option>
				{GENRES.map((g) => (
					<option key={g} value={g}>
						{g}
					</option>
				))}
			</select>

			<select
				value={sortBy}
				onChange={(e) => setSortBy(e.target.value as any)}
				className='cv-input px-4 py-3 rounded-xl text-sm text-cinema-200 appearance-none cursor-pointer'
				style={{
					background: '#1A1A1A',
					border: '1px solid #3A3A3A',
					minWidth: 140,
				}}
			>
				<option value='newest'>Newest first</option>
				<option value='rating'>Highest rated</option>
				<option value='title'>A → Z</option>
			</select>
		</div>
	</>
);

const EmptyState = ({ search, selectedGenre, isAdmin }: any) => (
	<div className='flex flex-col items-center justify-center py-32 text-center'>
		<div className='text-6xl mb-4'>🎬</div>

		<h3
			className='text-2xl font-semibold mb-2'
			style={{ fontFamily: "'Playfair Display', serif", color: '#EEEEEE' }}
		>
			{search || selectedGenre !== 'All'
				? 'No films found'
				: 'The vault is empty'}
		</h3>

		<p className='text-cinema-500 text-sm max-w-xs'>
			{search || selectedGenre !== 'All'
				? 'Try adjusting your search or filters.'
				: isAdmin
					? 'Start by adding your first film to the catalogue.'
					: 'No films have been added yet.'}
		</p>

		{isAdmin && !search && selectedGenre === 'All' && (
			<Link
				to='/addmovie'
				className='mt-6 px-6 py-3 rounded-xl text-sm font-semibold'
				style={{
					background: 'linear-gradient(135deg,#C9A84C,#A07830)',
					color: '#000',
				}}
			>
				Add your first film
			</Link>
		)}
	</div>
);

export const MovieList: React.FC = () => {
	const [search, setSearch] = useState('');
	const [selectedGenre, setSelectedGenre] = useState<Genre | 'All'>('All');
	const [sortBy, setSortBy] = useState<'newest' | 'rating' | 'title'>('newest');

	const { movies, isLoading, isAdmin } = useTracker(() => {
		const handle = Meteor.subscribe('movies');
		const user = Meteor.user();

		return {
			isLoading: !handle.ready(),
			movies: MoviesCollection.find({}, { sort: { createdAt: -1 } }).fetch(),
			isAdmin: user?.username === 'admin',
		};
	});

	const filtered = useMemo(() => {
		let result = [...movies];

		if (search.trim()) {
			const q = search.toLowerCase();
			result = result.filter(
				(m) =>
					m.title.toLowerCase().includes(q) ||
					m.author.toLowerCase().includes(q),
			);
		}

		if (selectedGenre !== 'All') {
			result = result.filter((m) => m.genre === selectedGenre);
		}

		if (sortBy === 'rating') {
			result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
		} else if (sortBy === 'title') {
			result.sort((a, b) => a.title.localeCompare(b.title));
		}

		return result;
	}, [movies, search, selectedGenre, sortBy]);

	return (
		<div className='max-w-7xl mx-auto px-6 py-10'>
			<Header movies={movies} isAdmin={isAdmin} />

			<Filters
				search={search}
				setSearch={setSearch}
				selectedGenre={selectedGenre}
				setSelectedGenre={setSelectedGenre}
				sortBy={sortBy}
				setSortBy={setSortBy}
			/>

			{selectedGenre !== 'All' && (
				<div className='flex items-center gap-2 mb-6'>
					<span className='text-sm text-cinema-400'>Showing:</span>

					<button
						onClick={() => setSelectedGenre('All')}
						className='flex items-center gap-1 text-xs px-3 py-1 rounded-full font-medium'
						style={{
							background: '#C9A84C22',
							color: '#C9A84C',
							border: '1px solid #C9A84C44',
						}}
					>
						{selectedGenre} ✕
					</button>
				</div>
			)}

			{isLoading ? (
				<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
					{Array.from({ length: 8 }).map((_, i) => (
						<SkeletonCard key={i} />
					))}
				</div>
			) : filtered.length === 0 ? (
				<EmptyState
					search={search}
					selectedGenre={selectedGenre}
					isAdmin={isAdmin}
				/>
			) : (
				<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
					{filtered.map((movie, i) => (
						<MovieCard
							key={movie._id}
							movie={movie}
							isAdmin={isAdmin}
							index={i}
						/>
					))}
				</div>
			)}
		</div>
	);
};
