// All portfolio content lives here. Levels: learning 30 / familiar 55 / proficient 75 / strong 90.

export const profile = {
  name: 'Saksham Sharma',
  short: 'SAKSHAM',
  role: 'B.Tech CSE Student & Builder',
  school: 'Pimpri Chinchwad University, Pune',
  batch: '2024 – 2028',
  status: 'Open to internships',
  email: 'sakshamamitsharma@gmail.com',
  github: 'https://github.com/sammy-master',
  linkedin: 'https://www.linkedin.com/in/saksham-sharma-14sept/',
  resume: '/Saksham_resume.pdf',
  tagline: 'Building software. Designing experiences. Learning every day.',
  bio: "I'm a Computer Science student at Pimpri Chinchwad University, Pune, who loves turning ideas into software: full-stack web apps, Python automation, C++ problem solving, and interfaces that feel alive.",
};

export const categories = [
  { id: 'code', label: 'Code & DSA' },
  { id: 'web', label: 'Web' },
  { id: 'sec', label: 'Security & Systems' },
  { id: 'ai', label: 'AI & Compute' },
  { id: 'design', label: 'Design' },
  { id: 'ship', label: 'Ship & Lead' },
];

const GH = (n) => `https://github.com/sammy-master/${n}`;

export const missions = [
  {
    id: 'hello', n: 1, game: 'type', year: '2022', title: 'Hello, World', verb: 'TYPE IT!',
    hint: 'Type the code exactly as shown', color: '#ffc23d', time: 10,
    story: "It started in school: PCM plus Computer Science at SB Patil Public School, Ravet. The first time a few typed lines of C printed to a black screen, I was hooked. Math gave me the logic; code gave me a place to use it.",
    skills: [
      { name: 'C', lvl: 55, cat: 'code' },
      { name: 'Logic & Math', lvl: 70, cat: 'code' },
    ],
    projects: [],
  },
  {
    id: 'sort', n: 2, game: 'sort', year: '2024', title: 'Sort It Out', verb: 'SORT IT!',
    hint: 'Click two bars to swap them. Shortest to tallest', color: '#3dffb5', time: 12,
    story: "B.Tech CSE at PCU began in 2024. I fell for C++ and Data Structures & Algorithms: arrays, linked lists, stacks, queues, trees, sorting. To truly understand them I built AlgoVision, which animates every algorithm step by step.",
    skills: [
      { name: 'C++', lvl: 90, cat: 'code' },
      { name: 'Data Structures & Algorithms', lvl: 68, cat: 'code' },
      { name: 'Java & OOP', lvl: 55, cat: 'code' },
    ],
    projects: [{ name: 'AlgoVision', url: GH('AlgoVision') }, { name: 'JavaVision', url: GH('JavaVision') }],
  },
  {
    id: 'bugs', n: 3, game: 'bugs', year: '2025', title: 'Bug Hunt', verb: 'SQUASH!',
    hint: 'Click every bug before time runs out', color: '#ff4fa3', time: 9,
    story: "Python became my Swiss-army knife: scripts, automation, data tools, and notebooks. I completed Python for Everybody (data structures, web data, databases), then shipped PyVision to run and explore Python programs right in the browser.",
    skills: [
      { name: 'Python', lvl: 75, cat: 'code' },
      { name: 'Automation Scripting', lvl: 65, cat: 'code' },
      { name: 'NumPy & PyTorch', lvl: 45, cat: 'ai' },
    ],
    projects: [{ name: 'PyVision', url: GH('PyVision') }, { name: 'ExactMatch Replace', url: GH('ExactMatch-Replace') }],
  },
  {
    id: 'phish', n: 4, game: 'phish', year: '2025', title: 'Spot the Phish', verb: 'SPOT IT!',
    hint: 'Click the fake link. Two rounds', color: '#ff5470', time: 10,
    story: "I completed the full Google Cybersecurity Specialization (eight courses: networks, Linux & SQL, detection & response, Python automation) plus Red Hat Linux administration. I turned that into PhishGuard, a machine-learning phishing URL detector, and VisCrypt, a visual cryptography tool.",
    skills: [
      { name: 'Cybersecurity', lvl: 70, cat: 'sec' },
      { name: 'Linux / RHEL', lvl: 55, cat: 'sec' },
      { name: 'Networking & SQL', lvl: 55, cat: 'sec' },
    ],
    projects: [{ name: 'PhishGuard', url: GH('phishguard') }, { name: 'VisCrypt', url: GH('Viscrypt') }],
  },
  {
    id: 'web', n: 5, game: 'assemble', year: '2025', title: 'Assemble the Web', verb: 'BUILD IT!',
    hint: 'Drag each block into its matching socket', color: '#22e4ff', time: 12,
    story: "Front-end is where logic meets craft. HTML5 and CSS3 are my strongest layers, and I went deeper through the Meta Web Development specialization: front-end, Django, and full-stack. I built real sites for Exotica PCMC and a 3D jewellery experience for SVJ.",
    skills: [
      { name: 'HTML5 & CSS3', lvl: 85, cat: 'web' },
      { name: 'JavaScript', lvl: 55, cat: 'web' },
      { name: 'React & Next.js', lvl: 35, cat: 'web' },
      { name: 'Django & REST', lvl: 50, cat: 'web' },
    ],
    projects: [{ name: 'Exotica PCMC', url: GH('Exotica-Main') }, { name: 'SVJ 3D', url: GH('SVJ---3D') }],
  },
  {
    id: 'tune', n: 6, game: 'tune', year: '2025', title: 'Tune the Vibe', verb: 'MATCH IT!',
    hint: 'Move to match the target color, then click', color: '#b07cff', time: 12,
    story: "I care how things feel, not just how they run. UI/UX in Figma, graphic design, branding, and video editing are part of my toolkit, because a great product deserves a great first impression.",
    skills: [
      { name: 'UI/UX (Figma)', lvl: 55, cat: 'design' },
      { name: 'Graphic Design', lvl: 55, cat: 'design' },
      { name: 'Video Editing', lvl: 55, cat: 'design' },
      { name: 'Branding', lvl: 35, cat: 'design' },
    ],
    projects: [{ name: 'Typing Samurai', url: GH('Typing-Samurai') }, { name: 'Arcade Hub', url: GH('Arcade-Hub') }],
  },
  {
    id: 'ship', n: 7, game: 'launch', year: '2025', title: 'Ship It', verb: 'LAUNCH!',
    hint: 'Hit the green zone three times: add, commit, push', color: '#ffc23d', time: 10,
    story: "A project isn't done until it's deployed. Git and GitHub are my daily drivers, Vercel is my launch pad, and MySQL powers the data side, like the Hostel Management portal I built with a Python Tkinter engine and a live web allocation UI.",
    skills: [
      { name: 'Git & GitHub', lvl: 75, cat: 'ship' },
      { name: 'Vercel Deployment', lvl: 55, cat: 'ship' },
      { name: 'MySQL & DBMS', lvl: 55, cat: 'ship' },
    ],
    projects: [{ name: 'Hostel Management', url: GH('Hostel-Management-DBMS-Project') }],
  },
  {
    id: 'chat', n: 8, game: 'chat', year: '2024 – now', title: 'Chat Raid', verb: 'REPLY!',
    hint: 'Answer the chats, but avoid the spam bubbles', color: '#3dffb5', time: 10,
    story: "Since 2024 I've built and run Discord communities that grew to hundreds of active members, with custom bots, automated workflows, and events. It taught me what no course can: leadership, moderation, and how people actually use software.",
    skills: [
      { name: 'Community Building', lvl: 80, cat: 'ship' },
      { name: 'Bot Development', lvl: 65, cat: 'ship' },
      { name: 'Leadership', lvl: 65, cat: 'ship' },
    ],
    projects: [],
  },
  {
    id: 'tensor', n: 9, game: 'tensor', year: '2026', title: 'Tensor Time', verb: 'COMPUTE!',
    hint: 'Solve the matrix products. Two correct answers', color: '#22e4ff', time: 14,
    story: "Curiosity pulled me toward the hardware that powers AI. I earned the AMD ROCm Certified Associate for GPU computing and the QC IUCEE Quantum Certificate, and finished the Operating Systems specialization: concurrency, memory, persistence, virtualization.",
    skills: [
      { name: 'GPU Compute (AMD ROCm)', lvl: 45, cat: 'ai' },
      { name: 'Quantum Fundamentals', lvl: 35, cat: 'ai' },
      { name: 'Operating Systems', lvl: 60, cat: 'sec' },
    ],
    projects: [],
  },
  {
    id: 'boss', n: 10, game: 'boss', year: '2025 – 2026', title: 'Hackathon Boss', verb: 'SURVIVE!',
    hint: 'Move to dodge the deadlines. Grab ideas. Survive 10s', color: '#ff5470', time: 10, boss: true,
    story: "Bosch gave me real engineering exposure through an industrial internship in 2025. In 2026, my team was selected to represent PCU Pune at Smart India Hackathon, national-level pressure, tight deadlines, and a prototype that had to ship.",
    skills: [
      { name: 'Rapid Prototyping', lvl: 70, cat: 'ship' },
      { name: 'Teamwork Under Pressure', lvl: 70, cat: 'ship' },
    ],
    projects: [],
  },
];

export const projects = [
  { name: 'AlgoVision', tag: 'DSA', blurb: 'Animated visualizer for sorting, searching and linear data structures.', url: GH('AlgoVision'), color: '#3dffb5' },
  { name: 'JavaVision', tag: 'JAVA', blurb: 'Run and explore Java programs through a universal terminal simulator.', url: GH('JavaVision'), color: '#ffc23d' },
  { name: 'PyVision', tag: 'PYTHON', blurb: 'Execute Python programs and notebooks natively in the browser.', url: GH('PyVision'), color: '#22e4ff' },
  { name: 'PhishGuard', tag: 'SECURITY · ML', blurb: 'ML-powered phishing URL detector with a FastAPI backend and React UI.', url: GH('phishguard'), color: '#ff5470' },
  { name: 'VisCrypt', tag: 'CRYPTO', blurb: 'Visual cryptography: split an image into shares that reveal it when stacked.', url: GH('Viscrypt'), color: '#b07cff' },
  { name: 'ExactMatch Replace', tag: 'TOOL', blurb: 'Multi-line find & replace with exact character mapping and zero regex surprises.', url: GH('ExactMatch-Replace'), color: '#22e4ff' },
  { name: 'Typing Samurai', tag: 'GAME', blurb: 'Speed-typing trainer with a samurai twist.', url: GH('Typing-Samurai'), color: '#ff4fa3' },
  { name: 'Arcade Hub', tag: 'GAME', blurb: 'A collection of classic browser games in one hub.', url: GH('Arcade-Hub'), color: '#ffc23d' },
  { name: 'Hostel Management', tag: 'DBMS', blurb: 'Smart room-allocation system: web portal plus Tkinter + MySQL engine.', url: GH('Hostel-Management-DBMS-Project'), color: '#3dffb5' },
  { name: 'SVJ 3D Experience', tag: 'WEB · 3D', blurb: 'Immersive 3D web experience for Suraj Verma Jewellers.', url: GH('SVJ---3D'), color: '#ff4fa3' },
  { name: 'Exotica PCMC', tag: 'WEB', blurb: 'Official website for Exotica PCMC.', url: GH('Exotica-Main'), color: '#b07cff' },
];

export const certs = [
  { title: 'Smart India Hackathon 2026', sub: 'Selected · represented PCU Pune', hot: true },
  { title: 'Bosch Internship', sub: 'Industrial engineering internship, 2025', hot: true },
  { title: 'AMD ROCm Certified Associate', sub: 'GPU computing', hot: true },
  { title: 'Google Cybersecurity Specialization', sub: '8 courses' },
  { title: 'Operating Systems Specialization', sub: 'Concurrency · Memory · Persistence · Virtualization' },
  { title: 'Python for Everybody Specialization', sub: '4 courses' },
  { title: 'Meta Web Development Specialization', sub: 'Front-end · Django · Full-stack' },
  { title: 'Red Hat Linux & OpenShift Specialization', sub: 'RHEL admin I & II' },
  { title: 'QC IUCEE Quantum Certificate', sub: 'Quantum computing' },
  { title: 'Programming with C++ · Java for Beginners', sub: 'Language foundations' },
];

export const facts = [
  'Fun fact: this whole portfolio is one WebGL scene, with no template and no UI kit.',
  'Fun fact: every sound here is synthesized live. There are zero audio files.',
  "Fun fact: I'm building this between DSA practice and way too many side projects.",
  'Fun fact: I was born on 14 September. Gifts accepted in the form of internship offers.',
];
