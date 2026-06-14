import { supabase } from './supabase';

export type NotificationType = 
  | 'MESSAGE' 
  | 'COMMENT_LIVRABLE' 
  | 'COMMENT_TACHE' 
  | 'VALIDATION_LIVRABLE' 
  | 'VALIDATION_ITERATION'
  | 'SUBMISSION_LIVRABLE'
  | 'MEETING_REQUEST'
  | 'GROUP_CREATED';

interface NotifyOptions {
  projectId: string;
  senderId: string;
  title: string;
  message: string;
  type: NotificationType;
}

/**
 * Helper function to send email via the backend API.
 */
const sendEmail = async (to: string, subject: string, text: string) => {
  try {
    const response = await fetch('/api/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to, subject, text }),
    });

    if (!response.ok) {
      console.error('Failed to send email notification:', await response.text());
    }
  } catch (err) {
    console.error('Error calling email API:', err);
  }
};

/**
 * Notifies all students associated with a project.
 */
export const notifyProjectStudents = async (options: NotifyOptions) => {
  const { projectId, senderId, title, message, type } = options;

  try {
    // 1. Fetch student IDs
    const { data: students, error: studentError } = await supabase
      .from('etudiants')
      .select('id')
      .eq('projet_id', projectId);

    if (studentError) {
      console.error('Error fetching students for notification:', studentError);
      return;
    }

    if (!students || students.length === 0) return;

    const studentIds = students.map(s => s.id).filter((id) => id !== senderId);

    if (studentIds.length === 0) return;

    // 2. Fetch student emails
    const { data: userDetails, error: userError } = await supabase
      .from('utilisateurs')
      .select('id, email, nom, prenom')
      .in('id', studentIds);

    if (userError) {
      console.error('Error fetching student emails:', userError);
    }

    // 3. Insert in-app notifications
    const notifications = studentIds.map((sid) => ({
      user_id: sid,
      sender_id: senderId,
      projet_id: projectId,
      title,
      message,
      type,
    }));

    const { error: notifyError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (notifyError) {
      console.error('Error inserting student notifications:', notifyError);
    }

    // 4. Send email notifications
    if (userDetails) {
      for (const u of userDetails) {
        if (u.email) {
          await sendEmail(
            u.email,
            `[StudentHub] ${title}`,
            `Hello ${u.prenom || ''},\n\nA new notification for your project:\n\n${message}\n\nCheck your dashboard for more details.`
          );
        }
      }
    }
  } catch (err) {
    console.error('Unexpected error in notifyProjectStudents:', err);
  }
};

/**
 * Notifies the professor associated with a project.
 */
export const notifyProjectProfessor = async (options: NotifyOptions) => {
  const { projectId, senderId, title, message, type } = options;

  try {
    // 1. Fetch the encadrant_id for this project
    const { data: project, error: projectError } = await supabase
      .from('projets')
      .select('encadrant_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project?.encadrant_id) {
      console.error('Error fetching project professor:', projectError);
      return;
    }

    // 2. Resolve the professor user id. Some projects store encadrants.id,
    // while others store utilisateurs.id directly.
    let professorUserId = project.encadrant_id;
    let { data: professor, error: profError } = await supabase
      .from('utilisateurs')
      .select('id, email, nom, prenom')
      .eq('id', professorUserId)
      .single();

    if (profError || !professor) {
      const { data: encadrant } = await supabase
        .from('encadrants')
        .select('*')
        .eq('id', project.encadrant_id)
        .single();

      const candidateIds = [
        encadrant?.utilisateur_id,
        encadrant?.user_id,
        encadrant?.auth_user_id,
      ].filter(Boolean);

      for (const candidateId of candidateIds) {
        const { data: candidateProfessor } = await supabase
          .from('utilisateurs')
          .select('id, email, nom, prenom')
          .eq('id', candidateId)
          .single();

        if (candidateProfessor) {
          professor = candidateProfessor;
          professorUserId = candidateProfessor.id;
          profError = null;
          break;
        }
      }
    }

    if (profError) {
      console.error('Error fetching professor details:', profError);
    }

    // 3. Insert in-app notification
    if (professorUserId !== senderId) {
      const notification = {
        user_id: professorUserId,
        sender_id: senderId,
        projet_id: projectId,
        title,
        message,
        type,
      };

      const { error: notifyError } = await supabase
        .from('notifications')
        .insert(notification);

      if (notifyError) {
        console.error('Error inserting professor notification:', notifyError);
      }
    }

    // 4. Send email notification
    if (professorUserId !== senderId && professor?.email) {
      await sendEmail(
        professor.email,
        `[StudentHub] ${title}`,
        `Hello Prof. ${professor.nom || ''},\n\nA student has performed an action on the project:\n\n${message}\n\nCheck your supervisor space for more details.`
      );
    }
  } catch (err) {
    console.error('Unexpected error in notifyProjectProfessor:', err);
  }
};

/**
 * Notifies all administrators.
 */
export const notifyAdmins = async (options: Omit<NotifyOptions, 'projectId'> & { projectId?: string }) => {
  const { senderId, title, message, type, projectId } = options;

  try {
    // 1. Fetch admin users
    const { data: admins, error: adminError } = await supabase
      .from('utilisateurs')
      .select('id, email, nom, prenom')
      .eq('role', 'ADMINISTRATEUR');

    if (adminError || !admins || admins.length === 0) {
      console.error('Error fetching admins:', adminError);
      return;
    }

    const recipientAdmins = admins.filter((admin) => admin.id !== senderId);
    if (recipientAdmins.length === 0) return;

    const notifications = recipientAdmins.map(admin => ({
      user_id: admin.id,
      sender_id: senderId,
      projet_id: projectId || null,
      title,
      message,
      type,
    }));

    // 2. Insert in-app notifications
    const { error: notifyError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (notifyError) {
      console.error('Error inserting admin notifications:', notifyError);
    }

    // 3. Send email notification
    for (const admin of recipientAdmins) {
      if (admin.email) {
        await sendEmail(
          admin.email,
          `[StudentHub Admin] ${title}`,
          `Hello ${admin.prenom || 'Admin'},\n\nA new action requires your attention:\n\n${message}\n\nCheck the admin dashboard for more details.`
        );
      }
    }
  } catch (err) {
    console.error('Unexpected error in notifyAdmins:', err);
  }
};


