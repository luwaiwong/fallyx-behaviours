import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { homeId, chainId } = await request.json();

    const userRef = adminDb.ref(`/users/${userId}`);
    const snapshot = await userRef.once('value');

    if (!snapshot.exists()) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = snapshot.val();

    // Only allow updating home/chain for homeUser role
    if (userData.role !== 'homeUser') {
      return NextResponse.json(
        { error: 'Home and chain can only be updated for homeUser role' },
        { status: 400 }
      );
    }

    // Validate chain exists if provided
    if (chainId) {
      const chainRef = adminDb.ref(`/chains/${chainId}`);
      const chainSnapshot = await chainRef.once('value');
      
      if (!chainSnapshot.exists()) {
        return NextResponse.json(
          { error: 'Chain not found' },
          { status: 404 }
        );
      }
    }

    // Validate home exists if provided
    if (homeId) {
      const homeRef = adminDb.ref(`/${homeId}`);
      const homeSnapshot = await homeRef.once('value');
      
      if (!homeSnapshot.exists()) {
        return NextResponse.json(
          { error: 'Home not found' },
          { status: 404 }
        );
      }

      // If chainId is provided, verify home belongs to that chain
      if (chainId) {
        const homeData = homeSnapshot.val();
        if (homeData.chainId !== chainId) {
          return NextResponse.json(
            { error: 'Home does not belong to the specified chain' },
            { status: 400 }
          );
        }
      } else {
        // If only homeId is provided, get chainId from home
        const homeData = homeSnapshot.val();
        if (homeData.chainId) {
          await userRef.update({ homeId, chainId: homeData.chainId });
          return NextResponse.json({
            success: true,
            message: 'User home and chain updated successfully'
          });
        }
      }
    }

    // Update user
    const updates: any = {};
    if (homeId) updates.homeId = homeId;
    if (chainId) updates.chainId = chainId;

    await userRef.update(updates);

    return NextResponse.json({
      success: true,
      message: 'User home and chain updated successfully'
    });

  } catch (error: unknown) {
    console.error('Error updating user home/chain:', error);
    return NextResponse.json(
      { error: 'Failed to update user home/chain', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


