import React, { createContext, useContext, useState, useEffect } from "react";
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut,
  User,
  sendPasswordResetEmail,
  updatePassword
} from "firebase/auth";
import { doc, getDoc, setDoc, getDocFromServer } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "../firebase";
import { UserProfile } from "../types";

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  resetPasswordEmail: (email: string) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  dbConnected: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbConnected, setDbConnected] = useState(true);

  useEffect(() => {
    // Test Firestore Connection on Boot (per Firebase Skill)
    const testFirestoreConnection = async () => {
      try {
        await getDocFromServer(doc(db, "connection-test", "init"));
        setDbConnected(true);
        console.log("Firestore connection test passed.");
      } catch (error: any) {
        if (error && (error.code === "permission-denied" || error.message?.includes("permission-denied") || error.message?.includes("permission"))) {
          setDbConnected(true);
          console.log("Firestore connection verified (server replied with permission check).");
        } else {
          setDbConnected(false);
          console.warn("Firestore running in offline/cached mode or is temporarily unavailable:", error?.message || error);
        }
      }
    };

    testFirestoreConnection();
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          let userDoc;
          try {
            userDoc = await getDoc(userDocRef);
          } catch (error) {
            handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
          }
          
          if (userDoc && userDoc.exists()) {
            const data = userDoc.data();
            
            // Check and increment session loginCount
            let currentLoginCount = data.loginCount || 0;
            const sessionKey = `login_counted_${currentUser.uid}`;
            if (!sessionStorage.getItem(sessionKey)) {
              currentLoginCount += 1;
              try {
                await setDoc(userDocRef, { loginCount: currentLoginCount }, { merge: true });
                sessionStorage.setItem(sessionKey, "true");
              } catch (e) {
                console.error("Error updating user metrics:", e);
              }
            }

            // Force upgrade root email to master role
            let resolvedRole: "master" | "admin" | "user" = data.role || "user";
            if (currentUser.email === "hugotjk2@gmail.com" && resolvedRole !== "master") {
              resolvedRole = "master";
              try {
                await setDoc(userDocRef, { role: "master" }, { merge: true });
              } catch (e) {
                console.error("Error force-upgrading root user to master role in Firestore:", e);
              }
            }

            setUserProfile({
              uid: currentUser.uid,
              email: currentUser.email || "",
              role: resolvedRole,
              accessType: data.accessType || "ALL",
              accessValues: data.accessValues || [],
              rawPassword: data.rawPassword || "",
              loginCount: currentLoginCount,
              needsPasswordReset: data.needsPasswordReset ?? false
            });
          } else {
            // Auto bootstrap hugotjk2@gmail.com
            if (currentUser.email === "hugotjk2@gmail.com") {
              const bootstrapProfile: Omit<UserProfile, "uid"> = {
                email: currentUser.email,
                role: "master",
                accessType: "ALL",
                accessValues: [],
                rawPassword: "",
                loginCount: 1,
                needsPasswordReset: false
              };
              try {
                await setDoc(userDocRef, bootstrapProfile);
              } catch (error) {
                handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}`);
              }
              setUserProfile({
                uid: currentUser.uid,
                ...bootstrapProfile
              });
            } else {
              // Denied user with no profile info
              setUserProfile({
                uid: currentUser.uid,
                email: currentUser.email || "",
                role: "user",
                accessType: "ALL",
                accessValues: [], // default limited access
                rawPassword: "",
                loginCount: 1,
                needsPasswordReset: false
              });
            }
          }
        } catch (error) {
          console.error("Error loading user profile:", error);
          setDbConnected(false);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const resetPasswordEmail = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const changePassword = async (newPassword: string) => {
    if (!auth.currentUser) throw new Error("Usuário não autenticado.");
    await updatePassword(auth.currentUser, newPassword);

    const userDocRef = doc(db, "users", auth.currentUser.uid);
    try {
      await setDoc(userDocRef, {
        rawPassword: newPassword,
        needsPasswordReset: false
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    }

    if (userProfile) {
      setUserProfile({
        ...userProfile,
        rawPassword: newPassword,
        needsPasswordReset: false
      });
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, login, resetPasswordEmail, changePassword, logout, dbConnected }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
