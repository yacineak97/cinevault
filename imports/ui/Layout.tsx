import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import { MoviesCollection } from '../db/MoviesCollection';
import { useToast } from './Toast';

export const Layout: React.FC = () => {
	const { showToast } = useToast();
	const location = useLocation();
	const [menuOpen, setMenuOpen] = useState(false);

	const { user, movieCount } = useTracker(() => {
		Meteor.subscribe('movies');
		return {
			user: Meteor.user(),
			movieCount: MoviesCollection.find({}).count(),
		};
	});

	const handleLogout = async () => {
		await new Promise<void>((resolve, reject) =>
			Meteor.logout((err) => (err ? reject(err) : resolve())),
		);
		showToast('Logged out. See you at the movies!', 'info');
	};

	const isAdmin = user?.username === 'admin';

	return (
		<div
			className='min-h-screen flex flex-col bg-cinema-900'
			style={{ fontFamily: "'DM Sans', sans-serif" }}
		>
			<nav
				className='sticky top-0 z-40 border-b border-cinema-700'
				style={{ background: 'rgba(9,9,9,0.92)', backdropFilter: 'blur(12px)' }}
			>
				<div className='max-w-7xl mx-auto px-6 flex items-center justify-between h-16'>
					<Link to='/' className='flex items-center gap-2 group'>
						<div
							className='w-8 h-8 rounded flex items-center justify-center'
							style={{ background: 'linear-gradient(135deg,#C9A84C,#A07830)' }}
						>
							<span
								className='text-black font-bold text-sm'
								style={{ fontFamily: "'Playfair Display', serif" }}
							>
								CV
							</span>
						</div>

						<span
							className='text-xl font-bold tracking-tight'
							style={{
								fontFamily: "'Playfair Display', serif",
								color: '#EEEEEE',
							}}
						>
							Cine<span style={{ color: '#C9A84C' }}>Vault</span>
						</span>
					</Link>

					<div className='hidden md:flex items-center gap-6'>
						{user && (
							<>
								<Link
									to='/'
									className={`text-sm font-medium transition-colors duration-200 ${
										location.pathname === '/'
											? 'text-gold'
											: 'text-cinema-300 hover:text-cinema-100'
									}`}
									style={{
										color: location.pathname === '/' ? '#C9A84C' : undefined,
									}}
								>
									Catalogue
								</Link>

								{isAdmin && (
									<Link
										to='/addmovie'
										className={`text-sm font-medium transition-colors duration-200 ${
											location.pathname === '/addmovie'
												? 'text-gold'
												: 'text-cinema-300 hover:text-cinema-100'
										}`}
										style={{
											color:
												location.pathname === '/addmovie'
													? '#C9A84C'
													: undefined,
										}}
									>
										+ Add Film
									</Link>
								)}
							</>
						)}
					</div>

					<div className='hidden md:flex items-center gap-4'>
						{user ? (
							<>
								<div
									className='flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium'
									style={{
										background: '#1A1A1A',
										border: '1px solid #3A3A3A',
										color: '#C9A84C',
									}}
								>
									<span>🎬</span>
									<span>{movieCount} films</span>
								</div>

								<div className='flex items-center gap-2'>
									<div
										className='w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold'
										style={{
											background: 'linear-gradient(135deg,#C9A84C,#A07830)',
											color: '#000',
										}}
									>
										{user.username?.[0]?.toUpperCase()}
									</div>

									<span className='text-sm text-cinema-300'>
										{user.username}
									</span>

									{isAdmin && (
										<span
											className='text-xs px-2 py-0.5 rounded-full font-mono'
											style={{
												background: '#C9A84C22',
												color: '#C9A84C',
												border: '1px solid #C9A84C44',
											}}
										>
											admin
										</span>
									)}
								</div>

								<button
									onClick={handleLogout}
									className='text-sm text-cinema-400 hover:text-cinema-100 transition-colors duration-200 flex items-center gap-1'
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
											d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1'
										/>
									</svg>
									Logout
								</button>
							</>
						) : (
							<div className='flex items-center gap-3'>
								<Link
									to='/login'
									className='text-sm text-cinema-300 hover:text-cinema-100 transition-colors duration-200'
								>
									Sign in
								</Link>

								<Link
									to='/signup'
									className='text-sm px-4 py-2 rounded-lg font-medium transition-all duration-200'
									style={{
										background: 'linear-gradient(135deg,#C9A84C,#A07830)',
										color: '#000',
									}}
								>
									Join
								</Link>
							</div>
						)}
					</div>

					<button
						className='md:hidden text-cinema-300 p-2'
						onClick={() => setMenuOpen((o) => !o)}
					>
						<svg
							className='w-6 h-6'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'
						>
							{menuOpen ? (
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M6 18L18 6M6 6l12 12'
								/>
							) : (
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M4 6h16M4 12h16M4 18h16'
								/>
							)}
						</svg>
					</button>
				</div>

				{menuOpen && (
					<div
						className='md:hidden border-t border-cinema-700 px-6 py-4 flex flex-col gap-4'
						style={{ background: 'rgba(9,9,9,0.98)' }}
					>
						{user ? (
							<>
								<Link
									to='/'
									onClick={() => setMenuOpen(false)}
									className='text-cinema-200'
								>
									Catalogue
								</Link>

								{isAdmin && (
									<Link
										to='/addmovie'
										onClick={() => setMenuOpen(false)}
										className='text-cinema-200'
									>
										+ Add Film
									</Link>
								)}

								<button
									onClick={() => {
										handleLogout();
										setMenuOpen(false);
									}}
									className='text-left text-cinema-400'
								>
									Logout
								</button>
							</>
						) : (
							<>
								<Link
									to='/login'
									onClick={() => setMenuOpen(false)}
									className='text-cinema-200'
								>
									Sign in
								</Link>

								<Link
									to='/signup'
									onClick={() => setMenuOpen(false)}
									className='text-cinema-200'
								>
									Join
								</Link>
							</>
						)}
					</div>
				)}
			</nav>

			<main className='flex-1'>
				<div className='page-enter'>
					<Outlet />
				</div>
			</main>
			<footer
				className='border-t border-cinema-700 mt-auto'
				style={{ background: '#080808' }}
			>
				<div className='max-w-7xl mx-auto px-6 py-10'>
					<div className='flex flex-col md:flex-row items-center justify-between gap-6'>
						<div className='flex items-center gap-2'>
							<div
								className='w-6 h-6 rounded flex items-center justify-center'
								style={{
									background: 'linear-gradient(135deg,#C9A84C,#A07830)',
								}}
							>
								<span
									className='text-black font-bold text-xs'
									style={{ fontFamily: "'Playfair Display', serif" }}
								>
									CV
								</span>
							</div>

							<span
								className='text-sm font-semibold'
								style={{
									fontFamily: "'Playfair Display', serif",
									color: '#888',
								}}
							>
								Cine<span style={{ color: '#C9A84C' }}>Vault</span>
							</span>
						</div>

						<p className='text-cinema-500 text-xs text-center'>
							Where great films live forever.
						</p>

						<div className='flex items-center gap-1 text-xs text-cinema-600'>
							<span>Built with</span>
							<span style={{ color: '#C9A84C' }}>♥</span>
							<span>on Meteor + React</span>
						</div>
					</div>
				</div>
			</footer>
		</div>
	);
};
