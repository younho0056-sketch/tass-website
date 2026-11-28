/** 홈 화면 로봇들(선임 TASS, 후임 TASS JR.)이 서로의 위치·상태를 아는 공용 메모 */
export type RobotName = 'senior' | 'junior';

export const robotState: Record<RobotName, { x: number; width: number; mode: string }> = {
  senior: { x: -999, width: 64, mode: 'idle' },
  junior: { x: -999, width: 66, mode: 'idle' },
};

/** 후임이 선임에게 보내는 신호 */
export const ROBOT_GREET_EVENT = 'tassbot:greet';
export const ROBOT_WAKE_EVENT = 'tassbot:wake';
