import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Meteor } from 'meteor/meteor';
import { useToast } from './Toast';

export const Login: React.FC = () => {
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [showPw, setShowPw] = useState(false);
	const [loading, setLoading] = useState(false);

	const navigate = useNavigate();
	const { showToast } = useToast();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);

		try {
			await new Promise<void>((resolve, reject) =>
				Meteor.loginWithPassword(username, password, (err) =>
					err ? reject(err) : resolve(),
				),
			);

			showToast(`Welcome back, ${username}!`, 'success');
			navigate('/');
		} catch (err: any) {
			showToast(err.message || 'Login failed', 'error');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div
			className='min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12'
			style={{
				background:
					'radial-gradient(ellipse at 50% 0%, #C9A84C0A 0%, transparent 60%), #0F0F0F',
			}}
		>
			<div className='w-full max-w-md'>
				<div className='text-center mb-10'>
					<div
						className='inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4'
						style={{ background: 'linear-gradient(135deg,#C9A84C,#A07830)' }}
					>
						<span
							className='text-black font-bold text-xl'
							style={{ fontFamily: "'Playfair Display', serif" }}
						>
							CV
						</span>
					</div>

					<h1
						className='text-3xl font-bold'
						style={{
							fontFamily: "'Playfair Display', serif",
							color: '#EEEEEE',
						}}
					>
						Welcome back
					</h1>

					<p className='text-cinema-500 text-sm mt-2'>
						Sign in to your CineVault
					</p>
				</div>

				<div
					className='rounded-2xl p-8'
					style={{
						background: '#141414',
						border: '1px solid #2A2A2A',
						boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
					}}
				>
					<form onSubmit={handleSubmit} className='space-y-5'>
						<div>
							<label
								className='block text-xs font-medium uppercase tracking-wider mb-2'
								style={{ color: '#888', letterSpacing: '0.08em' }}
							>
								Username
							</label>

							<input
								type='text'
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								placeholder='your username'
								required
								className='cv-input w-full px-4 py-3 rounded-xl text-sm text-cinema-100 placeholder-cinema-600 transition-all duration-200'
								style={{ background: '#1A1A1A', border: '1px solid #3A3A3A' }}
							/>
						</div>

						<div>
							<label
								className='block text-xs font-medium uppercase tracking-wider mb-2'
								style={{ color: '#888', letterSpacing: '0.08em' }}
							>
								Password
							</label>

							<div className='relative'>
								<input
									type={showPw ? 'text' : 'password'}
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder='••••••••'
									required
									className='cv-input w-full px-4 py-3 rounded-xl text-sm text-cinema-100 placeholder-cinema-600 transition-all duration-200 pr-12'
									style={{ background: '#1A1A1A', border: '1px solid #3A3A3A' }}
								/>

								<button
									type='button'
									onClick={() => setShowPw((p) => !p)}
									className='absolute right-3 top-1/2 -translate-y-1/2 text-cinema-500 hover:text-cinema-300 transition-colors'
								>
									<svg
										className='w-4 h-4'
										fill='none'
										stroke='currentColor'
										viewBox='0 0 24 24'
									>
										{showPw ? (
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={2}
												d='M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21'
											/>
										) : (
											<>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													strokeWidth={2}
													d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
												/>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													strokeWidth={2}
													d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
												/>
											</>
										)}
									</svg>
								</button>
							</div>
						</div>

						<button
							type='submit'
							disabled={loading}
							className='w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:opacity-90 hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed mt-2'
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
									Signing in...
								</span>
							) : (
								'Sign In'
							)}
						</button>
					</form>

					<div className='flex items-center gap-3 my-6'>
						<div className='flex-1 h-px' style={{ background: '#2A2A2A' }} />
						<span className='text-xs text-cinema-600'>or</span>
						<div className='flex-1 h-px' style={{ background: '#2A2A2A' }} />
					</div>

					<p className='text-center text-sm text-cinema-500'>
						New to CineVault?{' '}
						<Link
							to='/signup'
							className='font-medium hover:opacity-80 transition-opacity'
							style={{ color: '#C9A84C' }}
						>
							Create an account
						</Link>
					</p>
				</div>
			</div>
		</div>
	);
};
