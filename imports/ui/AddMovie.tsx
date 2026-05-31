import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Meteor } from 'meteor/meteor';
import { GENRES, Genre } from '../db/MoviesCollection';
import { useToast } from './Toast';
import { StarPicker } from './StarPicker';
import { PosterUpload } from './PosterUpload';

export const AddMovie: React.FC = () => {
	const [title, setTitle] = useState('');
	const [author, setAuthor] = useState('');
	const [description, setDescription] = useState('');
	const [genre, setGenre] = useState<Genre>(GENRES[0]);
	const [rating, setRating] = useState(0);
	const [year, setYear] = useState('');
	const [poster, setPoster] = useState('');
	const [loading, setLoading] = useState(false);

	const navigate = useNavigate();
	const { showToast } = useToast();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (rating === 0) {
			showToast('Please select a rating', 'error');
			return;
		}

		setLoading(true);
		try {
			await Meteor.callAsync(
				'movies.insert',
				title,
				author,
				description,
				genre,
				rating,
				year ? parseInt(year) : undefined,
				poster || undefined,
			);

			showToast(`"${title}" added to the vault!`, 'success');
			navigate('/');
		} catch (err: any) {
			showToast(err.message || 'Failed to add film', 'error');
		} finally {
			setLoading(false);
		}
	};

	const inputStyle = {
		background: '#1A1A1A',
		border: '1px solid #3A3A3A',
		color: '#EEEEEE',
	};

	const labelClass = 'block text-xs font-medium uppercase tracking-wider mb-2';
	const labelStyle = { color: '#888', letterSpacing: '0.08em' };

	return (
		<div className='max-w-2xl mx-auto px-6 py-12'>
			<div className='mb-10'>
				<p
					className='text-xs tracking-widest uppercase font-mono mb-2'
					style={{ color: '#C9A84C' }}
				>
					— Admin panel
				</p>
				<h1
					className='text-4xl font-bold'
					style={{ fontFamily: "'Playfair Display', serif", color: '#EEEEEE' }}
				>
					Add New Film
				</h1>
				<p className='text-cinema-500 text-sm mt-2'>
					Expand the CineVault catalogue
				</p>
			</div>

			<div
				className='rounded-2xl p-8'
				style={{
					background: '#141414',
					border: '1px solid #2A2A2A',
					boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
				}}
			>
				<form onSubmit={handleSubmit} className='space-y-6'>
					<div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
						<div className='sm:col-span-2'>
							<label className={labelClass} style={labelStyle}>
								Film Title
							</label>
							<input
								type='text'
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder='Enter film title'
								required
								className='cv-input w-full px-4 py-3 rounded-xl text-sm placeholder-cinema-600 transition-all duration-200'
								style={inputStyle}
							/>
						</div>
						<div>
							<label className={labelClass} style={labelStyle}>
								Year
							</label>
							<input
								type='number'
								value={year}
								onChange={(e) => setYear(e.target.value)}
								placeholder='2024'
								min='1888'
								max={new Date().getFullYear() + 2}
								className='cv-input w-full px-4 py-3 rounded-xl text-sm placeholder-cinema-600 transition-all duration-200'
								style={inputStyle}
							/>
						</div>
					</div>

					<div>
						<label className={labelClass} style={labelStyle}>
							Director
						</label>
						<input
							type='text'
							value={author}
							onChange={(e) => setAuthor(e.target.value)}
							placeholder="Director's name"
							required
							className='cv-input w-full px-4 py-3 rounded-xl text-sm placeholder-cinema-600 transition-all duration-200'
							style={inputStyle}
						/>
					</div>

					<div>
						<label className={labelClass} style={labelStyle}>
							Poster Image
						</label>
						<PosterUpload value={poster} onChange={setPoster} />
					</div>

					<div>
						<label className={labelClass} style={labelStyle}>
							Genre
						</label>
						<div className='flex flex-wrap gap-2'>
							{GENRES.map((g) => (
								<button
									key={g}
									type='button'
									onClick={() => setGenre(g)}
									className='px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150'
									style={{
										background: genre === g ? '#C9A84C22' : '#1A1A1A',
										border: `1px solid ${genre === g ? '#C9A84C' : '#3A3A3A'}`,
										color: genre === g ? '#C9A84C' : '#888',
									}}
								>
									{g}
								</button>
							))}
						</div>
					</div>

					<div>
						<label className={labelClass} style={labelStyle}>
							Your Rating
						</label>
						<StarPicker value={rating} onChange={setRating} />
					</div>

					<div>
						<label className={labelClass} style={labelStyle}>
							Synopsis
						</label>
						<textarea
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder='Write a brief synopsis...'
							rows={4}
							required
							className='cv-input w-full px-4 py-3 rounded-xl text-sm placeholder-cinema-600 transition-all duration-200 resize-none'
							style={inputStyle}
						/>
					</div>

					<div className='flex items-center gap-4 pt-2'>
						<button
							type='submit'
							disabled={loading}
							className='flex-1 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:opacity-90 hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed'
							style={{
								background: 'linear-gradient(135deg,#C9A84C,#A07830)',
								color: '#000',
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
									Adding...
								</span>
							) : (
								'Add to Vault'
							)}
						</button>

						<Link
							to='/'
							className='px-6 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 hover:opacity-80 text-center'
							style={{
								background: '#1A1A1A',
								border: '1px solid #3A3A3A',
								color: '#888',
							}}
						>
							Cancel
						</Link>
					</div>
				</form>
			</div>
		</div>
	);
};
