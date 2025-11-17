import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { username, password, role } = await request.json();

    if (!username || !password || !role) {
      return NextResponse.json(
        { error: 'Username, password, and role are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const email = `${username}@example.com`;
    const auth = getAuth();

    const userRecord = await auth.createUser({
      email,
      password,
      displayName: username
    });

    const userData = {
      role,
      loginCount: 0,
      createdAt: new Date().toISOString()
    };

    const userRef = adminDb.ref(`/users/${userRecord.uid}`);
    await userRef.set(userData);

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      user: {
        username: username,
        email: email,
        ...userData
      }
    });

  } catch (error: unknown) {
    console.error('Error creating user:', error);
    
    let errorMessage = 'Failed to create user';
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'auth/email-already-exists') {
        errorMessage = 'A user with this username already exists';
      } else if (error.code === 'auth/invalid-password') {
        errorMessage = 'Password is too weak';
      }
    }

    return NextResponse.json(
      { error: errorMessage, details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

