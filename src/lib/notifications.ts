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

    const studentIds = students.map(s => s.id);

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
            `Bonjour ${u.prenom || ''},\n\nUne nouvelle notification pour votre projet :\n\n${message}\n\nConsultez votre tableau de bord pour plus de détails.`
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

    // 2. Fetch the professor's email
    const { data: professor, error: profError } = await supabase
      .from('utilisateurs')
      .select('email, nom, prenom')
      .eq('id', project.encadrant_id)
      .single();

    if (profError) {
      console.error('Error fetching professor details:', profError);
    }

    // 3. Insert in-app notification
    const notification = {
      user_id: project.encadrant_id,
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

    // 4. Send email notification
    if (professor?.email) {
      await sendEmail(
        professor.email,
        `[StudentHub] ${title}`,
        `Bonjour M. ${professor.nom || ''},\n\nUn étudiant a effectué une action sur le projet :\n\n${message}\n\nConsultez votre espace d'encadrement pour plus de détails.`
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

    const notifications = admins.map(admin => ({
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
    for (const admin of admins) {
      if (admin.email) {
        await sendEmail(
          admin.email,
          `[StudentHub Admin] ${title}`,
          `Bonjour ${admin.prenom || 'Admin'},\n\nUne nouvelle action requiert votre attention :\n\n${message}\n\nConsultez le tableau de bord administrateur pour plus de détails.`
        );
      }
    }
  } catch (err) {
    console.error('Unexpected error in notifyAdmins:', err);
  }
};
