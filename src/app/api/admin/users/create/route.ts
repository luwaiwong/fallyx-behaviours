import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { username, password, role, homeId, chainId, createNewHome, newHomeName } = await request.json();

    if (!username || !password || !role) {
      return NextResponse.json(
        { error: 'Username, password, and role are required' },
        { status: 400 }
      );
    }

    // Validate role
    if (role !== 'admin' && role !== 'homeUser') {
      return NextResponse.json(
        { error: 'Role must be either "admin" or "homeUser"' },
        { status: 400 }
      );
    }

    // For homeUser, require home and chain
    if (role === 'homeUser') {
      if (!chainId || typeof chainId !== 'string') {
        return NextResponse.json(
          { error: 'Chain ID is required for homeUser' },
          { status: 400 }
        );
      }
      if (createNewHome) {
        if (!newHomeName || typeof newHomeName !== 'string') {
          return NextResponse.json(
            { error: 'Home name is required when creating a new home' },
            { status: 400 }
          );
        }
      } else {
        if (!homeId || typeof homeId !== 'string') {
          return NextResponse.json(
            { error: 'Home ID is required for homeUser' },
            { status: 400 }
          );
        }
      }
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const finalChainId = chainId;
    let finalHomeId = homeId;

    // Handle home creation
    if (createNewHome && newHomeName) {
      const sanitizedHomeName = newHomeName.trim().toLowerCase().replace(/\s+/g, '_');
      const homeRef = adminDb.ref(`/${sanitizedHomeName}`);
      const homeSnapshot = await homeRef.once('value');
      
      if (homeSnapshot.exists()) {
        return NextResponse.json(
          { error: 'Home already exists' },
          { status: 409 }
        );
      }

      // Verify chain exists
      const chainRef = adminDb.ref(`/chains/${finalChainId}`);
      const chainSnapshot = await chainRef.once('value');
      
      if (!chainSnapshot.exists()) {
        return NextResponse.json(
          { error: 'Chain not found' },
          { status: 404 }
        );
      }

      // Create home
      await homeRef.set({
        behaviours: {
          createdAt: new Date().toISOString()
        },
        chainId: finalChainId,
        createdAt: new Date().toISOString()
      });

      // Add home to chain
      const chainData = chainSnapshot.val();
      const homes = chainData.homes || [];
      if (!homes.includes(sanitizedHomeName)) {
        homes.push(sanitizedHomeName);
        await chainRef.update({ homes });
      }

      finalHomeId = sanitizedHomeName;
    }

    const email = `${username}@example.com`;
    const auth = getAuth();

    const userRecord = await auth.createUser({
      email,
      password,
      displayName: username
    });

    const userData: any = {
      role,
      loginCount: 0,
      createdAt: new Date().toISOString()
    };

    // Add home and chain info for homeUser
    if (role === 'homeUser') {
      userData.homeId = finalHomeId;
      userData.chainId = finalChainId;
    }

    const userRef = adminDb.ref(`/users/${userRecord.uid}`);
    await userRef.set(userData);

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      user: {
        id: userRecord.uid,
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

