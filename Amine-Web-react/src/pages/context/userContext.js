import { createContext, useContext } from 'react';

export const UserContext = createContext(null);

export const useUser = () => useContext(UserContext);

export const isProfileComplete = (profile) => {
  if (!profile) return false;
  const { name, school, className, email } = profile;
  return Boolean(name && school && className && email);
};
