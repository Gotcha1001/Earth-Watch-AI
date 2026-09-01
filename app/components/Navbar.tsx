"use client";

import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion } from "framer-motion";
import { useUserContext } from "../context/UserContext";
import { ThemeToggle } from "./ThemeToggle";
import { SidebarTrigger } from "@/components/ui/sidebar";

export default function Navbar() {
  return (
    <motion.nav
      className="flex items-center justify-between px-6 py-4 border-b bg-white dark:bg-gradient-to-r dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 border-gray-200 dark:border-green-900/30 shadow-sm"
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <SidebarTrigger className="md:hidden mr-2" />
      <Link
        href="/"
        className="flex items-center shrink-0 whitespace-nowrap text-xl font-black text-black dark:text-white tracking-tight"
      >
        🌍{" "}
        <span className="text-green-600 dark:text-green-400 ml-1">
          EARTH WATCH
        </span>{" "}
        <span className="text-blue-500 dark:text-blue-400">AI</span>
      </Link>
      <div className="flex items-center gap-3 shrink-0">
        <SignedOut>
          <Link href="/sign-in">
            <Button
              variant="ghost"
              className="text-gray-700 dark:text-gray-200 hover:text-red-600"
            >
              Sign In
            </Button>
          </Link>
          <Link href="/sign-up">
            <Button className="bg-red-600 dark:bg-red-700 text-white hover:bg-red-500">
              Sign Up
            </Button>
          </Link>
        </SignedOut>
        <SignedIn>
          <ThemeToggle />
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
      </div>
    </motion.nav>
  );
}
