import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import { Layout } from './Layout';
import { Login } from './Login';
import { Signup } from './Signup';
import { MovieList } from './MovieList';
import { AddMovie } from './AddMovie';
import { MovieDetails } from './MovieDetails';
import { NotFound } from './NotFound';
import { ToastProvider } from './Toast';

export const App: React.FC = () => {
	const user = useTracker(() => Meteor.user());

	return (
		<ToastProvider>
			<BrowserRouter>
				<Routes>
					<Route path='/' element={<Layout />}>
						<Route
							index
							element={user ? <MovieList /> : <Navigate to='/login' replace />}
						/>
						<Route
							path='login'
							element={!user ? <Login /> : <Navigate to='/' replace />}
						/>
						<Route
							path='signup'
							element={!user ? <Signup /> : <Navigate to='/' replace />}
						/>
						<Route
							path='addmovie'
							element={user ? <AddMovie /> : <Navigate to='/login' replace />}
						/>
						<Route
							path='movie-details/:_id'
							element={
								user ? <MovieDetails /> : <Navigate to='/login' replace />
							}
						/>
						<Route path='*' element={<NotFound />} />
					</Route>
				</Routes>
			</BrowserRouter>
		</ToastProvider>
	);
};
