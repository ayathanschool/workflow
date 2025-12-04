import { createContext, useContext } from 'react';

export const GoogleAuthContext = createContext({
	user: null,
	roles: [],
	idToken: null,
	loading: false,
	loginWithGoogle: async () => {},
	logout: () => {}
});

export function useGoogleAuth() {
	return useContext(GoogleAuthContext);
}

export default GoogleAuthContext;
