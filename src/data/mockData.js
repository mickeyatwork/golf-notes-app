export const MOCK_USERS_DB = [
  { id: 1, username: 'GolfHacker99', firstName: 'John', lastName: 'Doe', role: 'admin', handicap: 14, status: 'active' },
  { id: 2, username: 'GuestUser1', firstName: 'Jane', lastName: 'Smith', role: 'user', handicap: 22, status: 'active' },
];

export const MOCK_USER = MOCK_USERS_DB[0];

export const INITIAL_BAG = [
  { id: 1, name: 'Driver', carry: 250, stance: 'Ball forward, wide stance. Tee high.', swing: 'Hit up on it, smooth tempo.' },
  { id: 2, name: '7 Iron', carry: 160, stance: 'Ball center, slight shaft lean.', swing: 'Trap the ball, 80% effort.' },
  { id: 3, name: '56° Wedge', carry: 95, stance: 'Ball back, weight left.', swing: 'Accelerate through, do not decelerate!' },
  { id: 4, name: 'Putter', carry: 0, stance: 'Eyes over ball.', swing: 'Pendulum stroke.' }
];

export const MOCK_COURSES = [
  { id: 101, name: 'St Andrews (Old)', location: 'Fife, Scotland', distance: '0.2 mi', facilities: ['buggy', 'bar'] },
  { id: 102, name: 'Carnoustie Golf Links', location: 'Angus, Scotland', distance: '14.5 mi', facilities: ['range', 'bar'] },
  { id: 103, name: 'Sunningdale Golf Club', location: 'Berkshire, England', distance: '380 mi', facilities: ['buggy', 'range', 'bar'] }
];

export const MOCK_PAST_ROUNDS = [
  {
    id: 'round_88',
    courseId: 101,
    courseName: 'St Andrews (Old Course)',
    date: 'July 4th, 2026',
    totalScore: 84,
    holes: [
      { number: 1, par: 4, score: 4, shots: [{ id: 1, club: 'Driver', distance: 245 }, { id: 2, club: '7 Iron', distance: 150 }] },
      { number: 2, par: 4, score: 5, shots: [{ id: 3, club: 'Driver', distance: 260 }, { id: 4, club: '56° Wedge', distance: 80 }] },
      { number: 3, par: 4, score: 4, shots: [{ id: 5, club: 'Driver', distance: 230 }, { id: 6, club: '7 Iron', distance: 165 }] }
    ]
  }
];
