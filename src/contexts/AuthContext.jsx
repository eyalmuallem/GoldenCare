import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, firebaseConfigured } from '../config/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(firebaseConfigured);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (!firebaseConfigured) return undefined;

    let unsubscribeProfile = null;
    let unsubscribeOrganization = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setProfile(null);
      setOrganization(null);
      setLoading(false);

      unsubscribeProfile?.();
      unsubscribeOrganization?.();
      unsubscribeProfile = null;
      unsubscribeOrganization = null;

      if (!nextUser) return;

      setProfileLoading(true);
      unsubscribeProfile = onSnapshot(
        doc(db, 'users', nextUser.uid),
        (snapshot) => {
          if (!snapshot.exists()) {
            setProfile(null);
            setProfileLoading(false);
            return;
          }

          const nextProfile = { id: snapshot.id, ...snapshot.data() };
          setProfile(nextProfile);
          setProfileLoading(false);

          unsubscribeOrganization?.();
          unsubscribeOrganization = onSnapshot(
            doc(db, 'organizations', nextProfile.orgId),
            (orgSnapshot) => {
              setOrganization(orgSnapshot.exists() ? { id: orgSnapshot.id, ...orgSnapshot.data() } : null);
            }
          );
        },
        () => {
          setProfile(null);
          setProfileLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeProfile?.();
      unsubscribeOrganization?.();
    };
  }, []);

  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email.trim(), password);
  }

  async function logout() {
    return signOut(auth);
  }

  async function resetPassword(email) {
    return sendPasswordResetEmail(auth, email.trim());
  }

  async function bootstrapOrganization({ organizationName, displayName }) {
    if (!user) throw new Error('לא נמצא משתמש מחובר');
    const existingProfile = await getDoc(doc(db, 'users', user.uid));
    if (existingProfile.exists()) throw new Error('למשתמש כבר קיים פרופיל');

    const orgId = user.uid;
    const userData = {
      uid: user.uid,
      email: user.email || '',
      displayName: displayName.trim(),
      role: 'admin',
      orgId,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'organizations', orgId), {
      name: organizationName.trim(),
      ownerUid: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', user.uid), userData);
    batch.set(doc(db, 'organizations', orgId, 'staff', user.uid), userData);
    await batch.commit();
  }

  const value = useMemo(
    () => ({
      configured: firebaseConfigured,
      user,
      profile,
      organization,
      loading,
      profileLoading,
      isAdmin: profile?.role === 'admin',
      isCoach: profile?.role === 'coach',
      login,
      logout,
      resetPassword,
      bootstrapOrganization,
    }),
    [user, profile, organization, loading, profileLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
