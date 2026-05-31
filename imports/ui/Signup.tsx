import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Meteor } from 'meteor/meteor';
import { useToast } from './Toast';

export const Signup: React.FC = () => {
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [password2, setPassword2] = useState('');
	const [showPw, setShowPw] = useState(false);
	const [loading, setLoading] = useState(false);

	const navigate = useNavigate();
	const { showToast } = useToast();

	const strength =
		password.length === 0
			? 0
			: password.length < 6
				? 1
				: password.length < 10
					? 2
					: 3;

	const strengthLabel = ['', 'Weak', 'Good', 'Strong'] as const;
	const strengthColor = ['', '#EF4444', '#F59E0B', '#22C55E'] as const;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (password !== password2) {
			showToast('Passwords do not match', 'error');
			return;
		}

		setLoading(true);

		try {
			await Meteor.callAsync('users.insert', username, password);

			await new Promise<void>((resolve, reject) =>
				Meteor.loginWithPassword(username, password, (err) =>
					err ? reject(err) : resolve(),
				),
			);

			showToast(`Welcome to CineVault, ${username}!`, 'success');
			navigate('/');
		} catch (err: any) {
			showToast(err.message || 'Signup failed', 'error');
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
						style={{
							background: 'linear-gradient(135deg,#C9A84C,#A07830)',
						}}
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
						Join CineVault
					</h1>

					<p className='text-cinema-500 text-sm mt-2'>
						Create your personal film collection
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
								style={{ color: '#888' }}
							>
								Username
							</label>
							<input
								type='text'
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								placeholder='choose a username'
								required
								className='cv-input w-full px-4 py-3 rounded-xl text-sm text-cinema-100 placeholder-cinema-600 transition-all duration-200'
								style={{
									background: '#1A1A1A',
									border: '1px solid #3A3A3A',
								}}
							/>
						</div>
						<div>
							<label
								className='block text-xs font-medium uppercase tracking-wider mb-2'
								style={{ color: '#888' }}
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
									className='cv-input w-full px-4 py-3 rounded-xl text-sm text-cinema-100 placeholder-cinema-600 pr-12'
									style={{
										background: '#1A1A1A',
										border: '1px solid #3A3A3A',
									}}
								/>

								<button
									type='button'
									onClick={() => setShowPw((p) => !p)}
									className='absolute right-3 top-1/2 -translate-y-1/2 text-cinema-500 hover:text-cinema-300'
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
											d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
										/>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
										/>
									</svg>
								</button>
							</div>

							{password && (
								<div className='mt-2'>
									<div className='flex gap-1 mb-1'>
										{[1, 2, 3].map((i) => (
											<div
												key={i}
												className='h-1 flex-1 rounded-full'
												style={{
													background:
														i <= strength ? strengthColor[strength] : '#2A2A2A',
												}}
											/>
										))}
									</div>

									<span
										className='text-xs'
										style={{ color: strengthColor[strength] }}
									>
										{strengthLabel[strength]}
									</span>
								</div>
							)}
						</div>

						<div>
							<label
								className='block text-xs font-medium uppercase tracking-wider mb-2'
								style={{ color: '#888' }}
							>
								Confirm Password
							</label>

							<input
								type={showPw ? 'text' : 'password'}
								value={password2}
								onChange={(e) => setPassword2(e.target.value)}
								placeholder='••••••••'
								required
								className='cv-input w-full px-4 py-3 rounded-xl text-sm'
								style={{
									background: '#1A1A1A',
									border:
										password2 && password !== password2
											? '1px solid #EF4444'
											: '1px solid #3A3A3A',
									color: '#EEEEEE',
								}}
							/>

							{password2 && password !== password2 && (
								<p className='text-xs mt-1' style={{ color: '#EF4444' }}>
									Passwords don't match
								</p>
							)}
						</div>

						<button
							type='submit'
							disabled={loading}
							className='w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-50'
							style={{
								background: 'linear-gradient(135deg,#C9A84C,#A07830)',
								color: '#000',
							}}
						>
							{loading ? 'Creating account...' : 'Create Account'}
						</button>
					</form>

					<div className='flex items-center gap-3 my-6'>
						<div className='flex-1 h-px' style={{ background: '#2A2A2A' }} />
						<span className='text-xs text-cinema-600'>or</span>
						<div className='flex-1 h-px' style={{ background: '#2A2A2A' }} />
					</div>

					<p className='text-center text-sm text-cinema-500'>
						Already have an account?{' '}
						<Link
							to='/login'
							className='font-medium'
							style={{ color: '#C9A84C' }}
						>
							Sign in
						</Link>
					</p>
				</div>
			</div>
		</div>
	);
};
