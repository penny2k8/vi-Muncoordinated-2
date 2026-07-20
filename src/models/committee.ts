import {
  canonicalCountryName,
  MemberData,
  MemberID,
  MemberOption,
  membersToOptions,
  membersToPresentOptions,
  Rank
} from '../modules/member';
import {logCreateMember} from '../modules/analytics';
import _ from 'lodash';
import {CaucusData, CaucusID, DEFAULT_CAUCUS} from "./caucus";
import { DEFAULT_CAUCUS_TIME_SECONDS } from './constants';
import firebase from "firebase/compat/app";
import {PostData, PostID} from "./post";
import {MotionData, MotionID} from "./motion";
import {DEFAULT_TIMER, TimerData} from "./time";
import {ResolutionData, ResolutionID} from "./resolution";
import {DEFAULT_SETTINGS, SettingsData} from "./settings";
import {StrawpollData, StrawpollID} from "./strawpoll";

export function recoverMemberOptions(committee?: CommitteeData): MemberOption[] {
  if (committee) {
    return membersToOptions(committee.members);
  } else {
    return [];
  }
}

export function recoverPresentMemberOptions(committee?: CommitteeData): MemberOption[] {
  if (committee) {
    return membersToPresentOptions(committee.members);
  } else {
    return [];
  }
}

export function recoverMembers(committee?: CommitteeData): Record<MemberID, MemberData> | undefined {
  return committee ? (committee.members || {} as Record<MemberID, MemberData>) : undefined;
}

export function recoverSettings(committee?: CommitteeData): Required<SettingsData> {
  let timersInSeparateColumns: boolean =
    committee?.settings.timersInSeparateColumns
    ?? DEFAULT_SETTINGS.timersInSeparateColumns;

  const moveQueueUp: boolean =
    committee?.settings.moveQueueUp
    ?? DEFAULT_SETTINGS.moveQueueUp;

  const autoNextSpeaker: boolean =
    committee?.settings.autoNextSpeaker
    ?? DEFAULT_SETTINGS.autoNextSpeaker;

  const motionVotes: boolean =
    committee?.settings.motionVotes
    ?? DEFAULT_SETTINGS.motionVotes;

  const motionsArePublic: boolean =
    committee?.settings.motionsArePublic
    ?? DEFAULT_SETTINGS.motionsArePublic;

  return {
    timersInSeparateColumns,
    moveQueueUp,
    autoNextSpeaker,
    motionVotes,
    motionsArePublic
  };
}

export function recoverCaucus(committee: CommitteeData | undefined, caucusID: CaucusID): CaucusData | undefined {
  const caucuses = committee ? committee.caucuses : {};

  return (caucuses || {})[caucusID];
}

export function recoverResolution(committee: CommitteeData | undefined, resolutionID: ResolutionID): ResolutionData | undefined {
  const resolutions = committee ? committee.resolutions : {};

  return (resolutions || {})[resolutionID];
}

export type CommitteeID = string;

export enum Template {
  AfricanUnion = 'Liên minh châu Phi',
  ASEAN = 'Hiệp hội các quốc gia Đông Nam Á',
  BRICS = 'BRICS',
  EU = 'Liên Minh châu Âu',
  G20 = 'G20',
  NATO = 'Tổ chức Hiệp ước Bắc Đại Tây Dương',
  SecurityCouncil = 'Hội đồng Bảo an Liên Hợp Quốc',
  // TODO: Support these templates against at some point
  // UNHRC = 'UN Human Rights Council',
  // UNICEF = 'UN Children\'s Fund',
  // WHOHealthBoard = 'WHO Health Board',
}

export interface CommitteeData {
  name: string;
  chair: string;
  topic: string;
  conference?: string; // TODO: Migrate
  template?: Template;
  creatorUid: firebase.UserInfo['uid'];
  members?: Record<MemberID, MemberData>;
  caucuses?: Record<CaucusID, CaucusData>;
  resolutions?: Record<ResolutionID, ResolutionData>;
  strawpolls?: Record<StrawpollID, StrawpollData>;
  motions?: Record<MotionID, MotionData>;
  files?: Record<PostID, PostData>;
  timer: TimerData;
  notes: string;
  settings: SettingsData;
}

const GENERAL_SPEAKERS_LIST: CaucusData = {
  ...DEFAULT_CAUCUS, name: 'Danh sách phát biểu chung'
};
export const DEFAULT_COMMITTEE: CommitteeData = {
  name: '',
  chair: '',
  topic: '',
  conference: '',
  creatorUid: '',
  members: {} as Record<MemberID, MemberData>,
  caucuses: {
    'gsl': GENERAL_SPEAKERS_LIST
  } as Record<string, CaucusData>,
  resolutions: {} as Record<ResolutionID, ResolutionData>,
  files: {} as Record<PostID, PostData>,
  strawpolls: {} as Record<StrawpollID, StrawpollData>,
  motions: {} as Record<MotionID, MotionData>,
  timer: {...DEFAULT_TIMER, remaining: DEFAULT_CAUCUS_TIME_SECONDS},
  notes: '',
  settings: DEFAULT_SETTINGS
};
export const putCommittee =
  (committeeID: CommitteeID, committeeData: CommitteeData): firebase.database.Reference => {
    const ref = firebase.database()
      .ref('committees')
      .child(committeeID)

    ref.set(committeeData);

    return ref;
  };

// tslint:disable-next-line
export const putUnmodTimer = (committeeID: CommitteeID, timerData: TimerData): Promise<any> => {
  const ref = firebase.database()
    .ref('committees')
    .child(committeeID)
    .child('timer')
    .set(timerData);

  return ref;
};

// tslint:disable-next-line
const extendTimer = (ref: firebase.database.Reference, seconds: number): Promise<any> => {
  return ref.transaction((timerData: TimerData) => {
    if (timerData) {

      let newRemaining;

      // This is correct, if not a little unclear
      if (timerData.remaining <= 0) {
        newRemaining = seconds;
      } else if (!timerData.ticking) {
        newRemaining = timerData.remaining + seconds;
      } else {
        newRemaining = seconds;
      }

      return {...DEFAULT_TIMER, remaining: newRemaining};

    } else {
      return timerData;
    }
  });
};

// tslint:disable-next-line
export const extendModTimer = (committeeID: CommitteeID, caucusID: CaucusID, seconds: number): Promise<any> => {
  const ref = firebase.database()
    .ref('committees')
    .child(committeeID)
    .child('caucuses')
    .child(caucusID)
    .child('caucusTimer');

  return extendTimer(ref, seconds);
};

// tslint:disable-next-line
export const extendUnmodTimer = (committeeID: CommitteeID, seconds: number): Promise<any> => {
  const ref = firebase.database()
    .ref('committees')
    .child(committeeID)
    .child('timer');

  return extendTimer(ref, seconds);
};

export const pushMember = (committeeID: CommitteeID, member: MemberData) => {
  const ref = firebase.database()
    .ref('committees')
    .child(committeeID);


  ref.child('members').push().set(member);

  logCreateMember(member.name)
}

export const TEMPLATE_TO_MEMBERS: Record<Template, {
  name: MemberData['name']
  rank?: Rank // not allowed to use members due to import order
}[]> = {
  'Liên minh châu Phi': [
    {name: 'Ai Cập'},
    {name: 'Algeria'},
    {name: 'Angola'},
    {name: 'Benin'},
    {name: 'Botswana'},
    {name: 'Bờ Biển Ngà'},
    {name: 'Burkina Faso'},
    {name: 'Burundi'},
    {name: 'Cabo Verde'},
    {name: 'Cameroon'},
    {name: 'Cộng hòa Trung Phi'},
    {name: 'Chad'},
    {name: 'Comoros'},
    {name: 'CHDC Congo'},
    {name: 'Cộng hòa Congo'},
    {name: 'Djibouti'},
    {name: 'Eritrea'},
    {name: 'Eswatini'},
    {name: 'Ethiopia'},
    {name: 'Gabon'},
    {name: 'Gambia'},
    {name: 'Ghana'},
    {name: 'Guinea'},
    {name: 'Guinea-Bissau'},
    {name: 'Guinea Xích đạo'},
    {name: 'Kenya'},
    {name: 'Lesotho'},
    {name: 'Liberia'},
    {name: 'Libya'},
    {name: 'Madagascar'},
    {name: 'Malawi'},
    {name: 'Mali'},
    {name: 'Mauritania'},
    {name: 'Mauritius'},
    {name: 'Morocco'},
    {name: 'Mozambique'},
    {name: 'Namibia'},
    {name: 'Nam Phi'},
    {name: 'Nam Sudan'},
    {name: 'Niger'},
    {name: 'Nigeria'},
    {name: 'Rwanda'},
    {name: 'Sao Tome và Principe'},
    {name: 'Senegal'},
    {name: 'Seychelles'},
    {name: 'Sierra Leone'},
    {name: 'Somalia'},
    {name: 'Sudan'},
    {name: 'Tanzania'},
    {name: 'Tây Sahara'},
    {name: 'Togo'},
    {name: 'Tunisia'},
    {name: 'Uganda'},
    {name: 'Zambia'},
    {name: 'Zimbabwe'}
  ],
  'Hiệp hội các quốc gia Đông Nam Á': [
    {name: 'Brunei Darussalam'},
    {name: 'Campuchia'},
    {name: 'Indonesia'},
    {name: 'Lào'},
    {name: 'Malaysia'},
    {name: 'Myanmar'},
    {name: 'Philippines'},
    {name: 'Singapore'},
    {name: 'Thái Lan'},
    {name: 'Timor-Leste'},
    {name: 'Việt Nam'}
  ],
  'BRICS': [
    {name: 'Ai Cập'},
    {name: 'Ả-rập Xê-út'},
    {name: 'Ấn Độ'},
    {name: 'Brazil'},
    {name: 'Các Tiểu vương quốc Arab thống nhất'},
    {name: 'Ethiopia'},
    {name: 'Indonesia'},
    {name: 'Iran'},
    {name: 'Nam Phi'},
    {name: 'Nga'},
    {name: 'Trung Quốc'},
  ],
  'Liên Minh châu Âu': [
    {name: 'Áo'},
    {name: 'Ba Lan'},
    {name: 'Bỉ'},
    {name: 'Bồ Đào Nha'},
    {name: 'Bulgaria'},
    {name: 'Croatia'},
    {name: 'Cyprus'},
    {name: 'Cộng hòa Séc'},
    {name: 'Đan Mạch'},
    {name: 'Đức'},
    {name: 'Estonia'},
    {name: 'Hy Lạp'},
    {name: 'Hungary'},
    {name: 'Hà Lan'},
    {name: 'Ireland'},
    {name: 'Latvia'},
    {name: 'Lithuania'},
    {name: 'Luxembourg'},
    {name: 'Malta'},
    {name: 'Phần Lan'},
    {name: 'Pháp'},
    {name: 'Romania'},
    {name: 'Slovakia'},
    {name: 'Slovenia'},
    {name: 'Tây Ban Nha'},
    {name: 'Thụy Điển'},
    {name: 'Ý'},
  ],
  'G20': [
    {name: 'Ấn Độ'},
    {name: 'Ả-rập Xê-út'},
    {name: 'Argentina'},
    {name: 'Úc'},
    {name: 'Brazil'},
    {name: 'Canada'},
    {name: 'Trung Quốc'},
    {name: 'Đức'},
    {name: 'Liên minh châu Âu'},
    {name: 'Pháp'},
    {name: 'Hàn Quốc'},
    {name: 'Hoa Kỳ'},
    {name: 'Indonesia'},
    {name: 'Nhật Bản'},
    {name: 'Mexico'},
    {name: 'Nam Phi'},
    {name: 'Nga'},
    {name: 'Thổ Nhĩ Kỳ'},
    {name: 'Vương quốc Anh'},
    {name: 'Ý'},
  ],
  'Tổ chức Hiệp ước Bắc Đại Tây Dương': [
    {name: 'Albania'},
    {name: 'Antille thuộc Hà Lan'},
    {name: 'Ba Lan'},
    {name: 'Bắc Macedonia'},
    {name: 'Bỉ'},
    {name: 'Bồ Đào Nha'},
    {name: 'Bulgaria'},
    {name: 'Canada'},
    {name: 'Croatia'},
    {name: 'Cộng hòa Séc'},
    {name: 'Đan Mạch'},
    {name: 'Đức'},
    {name: 'Estonia'},
    {name: 'Hà Lan'},
    {name: 'Hoa Kỳ'},
    {name: 'Hy Lạp'},
    {name: 'Hungary'},
    {name: 'Iceland'},
    {name: 'Latvia'},
    {name: 'Lithuania'},
    {name: 'Luxembourg'},
    {name: 'Montenegro'},
    {name: 'Na Uy'},
    {name: 'Phần Lan'},
    {name: 'Pháp'},
    {name: 'Romania'},
    {name: 'Slovakia'},
    {name: 'Slovenia'},
    {name: 'Tây Ban Nha'},
    {name: 'Thổ Nhĩ Kỳ'},
    {name: 'Thụy Điển'},
    {name: 'Vương quốc Anh'},
    {name: 'Ý'},
  ],
  'Hội đồng Bảo an Liên Hợp Quốc': [
    {name: 'Bahrain'},
    {name: 'CHDC Congo'},
    {name: 'Đan Mạch'},
    {name: 'Pháp', rank: Rank.Veto},
    {name: 'Hy Lạp'},
    {name: 'Hoa Kỳ', rank: Rank.Veto},
    {name: 'Latvia'},
    {name: 'Liberia'},
    {name: 'Nga', rank: Rank.Veto},
    {name: 'Pakistan'},
    {name: 'Panama'},
    {name: 'Somalia'},
    {name: 'Trung Quốc', rank: Rank.Veto},
    {name: 'Vương quốc Anh', rank: Rank.Veto},
  ],
}
export const pushTemplateMembers = (committeeID: CommitteeID, template: Template) => {
  const ref = firebase.database()
    .ref('committees')
    .child(committeeID);

  ref.child('members').once('value', (snapshot) => {
    const members: Record<MemberID, MemberData> = snapshot.val() || {};
    const memberNames = Object.keys(members).map(id =>
      canonicalCountryName(members[id].name)
    );

    [...TEMPLATE_TO_MEMBERS[template]]
      // Don't try and readd members that already exist
      .filter(member => !_.includes(memberNames, canonicalCountryName(member.name)))
      .forEach(
        member =>
          pushMember(committeeID, {
            name: member.name,
            rank: member.rank ?? Rank.Standard,
            present: true,
            voting: false,
          })
      );
  });
}
