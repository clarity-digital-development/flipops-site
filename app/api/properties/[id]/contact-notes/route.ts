import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ContactNote {
  date: string;
  note: string;
  method: string; // "phone", "email", "sms", "in_person"
  sentiment?: string; // "positive", "neutral", "negative"
}

/**
 * POST /api/properties/[id]/contact-notes
 * Add a contact note to a property's contact history
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = "mock-user-id"; // Temporary for CSS debugging

    const { id } = await params;
    if (id.startsWith('virt-')) {
      return NextResponse.json(
        {
          error: 'Virtual lead — promote it first',
          hint: 'POST /api/properties/promote with { countyFips, apn } to materialize a Property row, then retry against the returned id.',
          code: 'VIRTUAL_LEAD_NOT_PROMOTED',
        },
        { status: 409 },
      );
    }

    const body = await request.json();

    // Verify the property belongs to the user
    const property = await prisma.property.findFirst({
      where: { id, userId },
    });

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    // Parse existing contact notes
    let contactNotes: ContactNote[] = [];
    if (property.contactNotes) {
      try {
        contactNotes = JSON.parse(property.contactNotes);
      } catch (e) {
        console.error('Failed to parse existing contact notes:', e);
      }
    }

    // Create new note
    const newNote: ContactNote = {
      date: new Date().toISOString(),
      note: body.note || '',
      method: body.method || 'phone',
      sentiment: body.sentiment,
    };

    // Add to array
    contactNotes.push(newNote);

    // Update property with new notes and latest contact info
    const updateData: any = {
      contactNotes: JSON.stringify(contactNotes),
      lastContactDate: new Date(),
      lastContactMethod: newNote.method,
    };

    // Update status if provided
    if (body.outreachStatus) {
      updateData.outreachStatus = body.outreachStatus;
    }

    // Update owner response if provided
    if (body.ownerResponse) {
      updateData.ownerResponse = body.ownerResponse;
    }

    // Update sentiment if provided
    if (newNote.sentiment) {
      updateData.sentiment = newNote.sentiment;
    }

    // Update next follow-up date if provided
    if (body.nextFollowUpDate) {
      updateData.nextFollowUpDate = new Date(body.nextFollowUpDate);
    }

    const updated = await prisma.property.update({
      where: { id },
      data: updateData,
    });

    // Auto-create follow-up task if nextFollowUpDate is set
    let createdTask = null;
    if (body.nextFollowUpDate) {
      try {
        const propertyAddress = `${property.address}, ${property.city}, ${property.state}`;
        const ownerName = property.ownerName || 'owner';

        createdTask = await prisma.task.create({
          data: {
            userId,
            propertyId: id,
            type: 'follow_up',
            title: `Follow up with ${ownerName} - ${propertyAddress}`,
            description: body.note ? `Previous contact: ${body.note}` : undefined,
            dueDate: new Date(body.nextFollowUpDate),
            priority: body.sentiment === 'positive' ? 'high' : 'medium',
          },
        });
      } catch (taskError) {
        console.error('Failed to auto-create follow-up task:', taskError);
        // Don't fail the whole request if task creation fails
      }
    }

    return NextResponse.json({
      success: true,
      property: updated,
      note: newNote,
      task: createdTask,
    });
  } catch (error) {
    console.error('Error adding contact note:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/properties/[id]/contact-notes
 * Get all contact notes for a property
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = "mock-user-id"; // Temporary for CSS debugging

    const { id } = await params;

    const property = await prisma.property.findFirst({
      where: { id, userId },
      select: {
        contactNotes: true,
        lastContactDate: true,
        lastContactMethod: true,
        outreachStatus: true,
        sentiment: true,
      },
    });

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    // Parse contact notes
    let contactNotes: ContactNote[] = [];
    if (property.contactNotes) {
      try {
        contactNotes = JSON.parse(property.contactNotes);
      } catch (e) {
        console.error('Failed to parse contact notes:', e);
      }
    }

    return NextResponse.json({
      contactNotes,
      lastContactDate: property.lastContactDate,
      lastContactMethod: property.lastContactMethod,
      outreachStatus: property.outreachStatus,
      sentiment: property.sentiment,
    });
  } catch (error) {
    console.error('Error fetching contact notes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
