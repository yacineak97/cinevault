import React, {
	createContext,
	useContext,
	useState,
	useCallback,
	ReactNode,
} from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
	id: number;
	message: string;
	type: ToastType;
}

interface ToastContextValue {
	showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({
	showToast: () => {},
});

let toastId = 0;

export const ToastProvider: React.FC<{ children: ReactNode }> = ({
	children,
}) => {
	const [toasts, setToasts] = useState<Toast[]>([]);

	const showToast = useCallback((message: string, type: ToastType = 'info') => {
		const id = ++toastId;

		setToasts((prev) => [...prev, { id, message, type }]);

		setTimeout(() => {
			setToasts((prev) => prev.filter((t) => t.id !== id));
		}, 3500);
	}, []);

	const icons: Record<ToastType, string> = {
		success: '✓',
		error: '✕',
		info: 'ℹ',
	};

	const styles: Record<ToastType, string> = {
		success: 'border-l-4 border-green-500 bg-cinema-800',
		error: 'border-l-4 border-red-500 bg-cinema-800',
		info: 'border-l-4 border-gold bg-cinema-800',
	};

	const iconColors: Record<ToastType, string> = {
		success: 'text-green-400',
		error: 'text-red-400',
		info: 'text-gold',
	};

	return (
		<ToastContext.Provider value={{ showToast }}>
			{children}

			<div className='fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none'>
				{toasts.map((toast) => (
					<div
						key={toast.id}
						className={`
							${styles[toast.type]}
							pointer-events-auto
							flex items-center gap-3 px-5 py-4 rounded-lg shadow-2xl
							text-cinema-100 text-sm font-medium
							animate-slide-up backdrop-blur-sm
							min-w-[280px] max-w-[360px]
						`}
						style={{ background: '#1A1A1AEE' }}
					>
						<span className={`text-base font-bold ${iconColors[toast.type]}`}>
							{icons[toast.type]}
						</span>

						<span>{toast.message}</span>
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
};

export const useToast = () => useContext(ToastContext);
