"use client";

import { createContext, useContext } from "react";

interface User {
  _id: string;
  clerkId: string;
  email: string;
  name: string;
  imageUrl?: string;
  role: "admin" | "user";
  createdAt: number;
}

export const UserContext = createContext<User | null>(null);
export function useUserContext() {
  return useContext(UserContext);
}
