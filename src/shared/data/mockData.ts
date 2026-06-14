import { Project, Message, TaskColumn, Member, GroupLivrables } from '../types';

export const groupLivrables: GroupLivrables[] = [
  {
    groupName: 'Web Designing Group',
    deliverables: [
      { id: 1, title: 'Project Specification', type: 'PDF', date: 'Oct 12, 2023', status: 'SUBMITTED', size: '2.4 MB' },
      { id: 2, title: 'Wireframes & Prototypes', type: 'ZIP', date: 'Oct 25, 2023', status: 'SUBMITTED', size: '15.8 MB' },
      { id: 3, title: 'Frontend Source Code', type: 'LINK', date: 'Nov 05, 2023', status: 'PENDING' },
    ]
  },
  {
    groupName: 'Mobile App Group',
    deliverables: [
      { id: 4, title: 'User Research Report', type: 'DOC', date: 'Sep 30, 2023', status: 'SUBMITTED', size: '1.1 MB' },
      { id: 5, title: 'UI Design Assets', type: 'ZIP', date: 'Oct 15, 2023', status: 'LATE', size: '45.2 MB' },
    ]
  },
  {
    groupName: 'Medical Dashboard Group',
    deliverables: [
      { id: 6, title: 'Database Schema', type: 'PDF', date: 'Nov 01, 2023', status: 'SUBMITTED', size: '0.8 MB' },
      { id: 7, title: 'API Documentation', type: 'LINK', date: 'Nov 10, 2023', status: 'PENDING' },
    ]
  }
];

export const members: Member[] = [
  {
    id: 1,
    name: 'Hira R',
    email: 'hira.r@student.ma',
    phone: '+212 612-345678',
    cne: 'D134567890',
    cin: 'AB123456',
    linkedin: 'linkedin.com/in/hirar',
    github: 'github.com/hirar',
    avatar: 'https://picsum.photos/seed/hira/150/150'
  },
  {
    id: 2,
    name: 'David Smith',
    email: 'david.s@student.ma',
    phone: '+212 612-987654',
    cne: 'G139876543',
    cin: 'CD789012',
    linkedin: 'linkedin.com/in/davidsmith',
    github: 'github.com/davidsmith',
    avatar: 'https://picsum.photos/seed/david/150/150'
  },
  {
    id: 3,
    name: 'Stephanie J',
    email: 'steph.j@student.ma',
    phone: '+212 612-112233',
    cne: 'K131122334',
    cin: 'EF345678',
    linkedin: 'linkedin.com/in/stephj',
    github: 'github.com/stephj',
    avatar: 'https://picsum.photos/seed/steph/150/150'
  },
  {
    id: 4,
    name: 'William Doe',
    email: 'william.d@student.ma',
    phone: '+212 612-445566',
    cne: 'M134455667',
    cin: 'GH901234',
    linkedin: 'linkedin.com/in/williamdoe',
    github: 'github.com/williamdoe',
    avatar: 'https://picsum.photos/seed/will/150/150'
  }
];

export const projects: Project[] = [
  { id: 1, title: 'Web Designing', category: 'Prototyping', progress: 90, date: 'Feb 2, 2021', timeLeft: '2 days Left', color: 'from-teal-500 to-emerald-500' },
  { id: 2, title: 'Mobile App', category: 'Shopping', progress: 30, date: 'Feb 5, 2021', timeLeft: '3 week left', color: 'from-orange-500 to-amber-500' },
  { id: 3, title: 'Dashboard', category: 'Medical', progress: 50, date: 'March 03, 2021', timeLeft: '2 week left', color: 'from-red-500 to-rose-500' },
  { id: 4, title: 'Web Designing', category: 'Wireframing', progress: 20, date: 'March 08, 2021', timeLeft: '3 week left', color: 'from-blue-500 to-indigo-500' },
];

export const chatMessages: Message[] = [
  { id: 1, sender: 'Georgia Fernandez', text: 'Hi Naveen How r u there doing I\'ve called u yesterday', time: '22 NOV AT 5:33 PM', isMe: false, avatar: 'https://picsum.photos/seed/user1/40/40' },
  { id: 2, sender: 'Me', text: 'Hi, ya I\'ve seen just now, I was in a meeting then I forgot to call u', time: '22 NOV AT 5:35 PM', isMe: true, avatar: 'https://picsum.photos/seed/me/40/40' },
  { id: 3, sender: 'Georgia Fernandez', text: 'Ok, Tomorrow @RetroCoffee 8pm?', time: '22 NOV AT 5:36 PM', isMe: false, avatar: 'https://picsum.photos/seed/user1/40/40' },
  { id: 4, sender: 'Me', text: 'Ok then, see u there âš¡ï¸', time: '22 NOV AT 5:38 PM', isMe: true, avatar: 'https://picsum.photos/seed/me/40/40' },
  { id: 5, sender: 'Georgia Fernandez', text: 'ðŸ‘ Ok then byee for now', time: '22 NOV AT 5:40 PM', isMe: false, avatar: 'https://picsum.photos/seed/user1/40/40' },
  { id: 6, sender: 'Me', text: 'Ok bye', time: '22 NOV AT 5:41 PM', isMe: true, avatar: 'https://picsum.photos/seed/me/40/40' },
];

export const taskColumns: TaskColumn[] = [
  {
    title: 'Team Tasks',
    subtitle: 'Need to do ASAP',
    tasks: [
      { id: 1, title: 'First pass at API documentation', assignee: 'poppajun & kate1993', status: 'PENDING', date: 'Nov 2, 2019', comments: 3, likes: 91 },
      { id: 2, title: 'Robert book delivery', assignee: 'shapppkin@yahoo.com', status: 'PENDING', date: 'Nov 2, 2019', comments: 0, likes: 14 },
      { id: 3, title: 'Créer backup strategy for backend', assignee: 'bubblegumboy & coldbrew', status: 'DONE', date: 'Dec 13, 2019', comments: 2, likes: 11 },
    ]
  },
  {
    title: 'Ideas to Vote On',
    subtitle: 'Upcoming',
    tasks: [
      { id: 4, title: 'Add a config setting that tells the search engine to ignore the category name', assignee: 'Carlee Simmons', status: 'DONE', date: 'Nov 1, 2019', comments: 2, likes: 3 },
      { id: 5, title: 'Ability to restrict content by user characteristics', assignee: 'GreenyGreen#1387', status: 'PENDING', date: 'Nov 1, 2019', comments: 0, likes: 0 },
      { id: 6, title: 'Add a task-specific announcement feature', assignee: 'POPPA & kate1993', status: 'URGENT', date: 'Nov 3, 2019', comments: 10, likes: 16 },
    ]
  },
  {
    title: 'Other stuff',
    subtitle: 'It\'ll be sorted... someday',
    tasks: [
      { id: 7, title: 'Mettre à jour log v1.4 Onhovered card!', assignee: 'Jennyfer Onhover', status: 'DONE', date: 'Nov 9, 2019', comments: 0, likes: 1 },
      { id: 8, title: 'Family to-do list', assignee: 'Robert added a new task', status: 'PENDING', date: 'Nov 9, 2019', comments: 13, likes: 56 },
      { id: 9, title: 'File upload', assignee: 'shapppkin@yahoo.com', status: 'PENDING', date: 'Nov 9, 2019', comments: 1, likes: 15 },
    ]
  }
];



