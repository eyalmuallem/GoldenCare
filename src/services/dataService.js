import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getStatusForMonth, isMonthInRange } from '../utils/date';

const orgCollection = (orgId, name) => collection(db, 'organizations', orgId, name);
const orgDocument = (orgId, name, id) => doc(db, 'organizations', orgId, name, id);

function mapSnapshot(snapshot) {
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function sorted(items, key) {
  return [...items].sort((a, b) => String(a[key] || '').localeCompare(String(b[key] || ''), 'he'));
}

function isRecurringPaymentMethod(paymentMethod) {
  return paymentMethod === 'direct_debit' || paymentMethod === 'checks';
}

export function getEnrollmentMonthlyPaymentDefault(enrollment) {
  if (!isRecurringPaymentMethod(enrollment.paymentMethod)) return 'unpaid';
  if (enrollment.monthlyPaymentDefault === 'paid' || enrollment.monthlyPaymentDefault === 'unpaid') {
    return enrollment.monthlyPaymentDefault;
  }
  return enrollment.initialPaymentStatus === 'paid' ? 'paid' : 'unpaid';
}

function buildMonthlyChargeState(enrollment, month) {
  const activityStatus = getStatusForMonth(enrollment.statusHistory, month);
  const isChargeable = activityStatus === 'active';
  const amount = isChargeable ? Number(enrollment.finalPrice || 0) : 0;
  const monthlyPaymentDefault = getEnrollmentMonthlyPaymentDefault(enrollment);
  const status = isChargeable ? monthlyPaymentDefault : 'no_charge';
  const amountPaid = status === 'paid' ? amount : 0;

  return {
    activityStatus,
    amount,
    status,
    amountPaid,
    monthlyPaymentDefault,
  };
}

function hasManualChargeOverride(charge) {
  if (charge.manualOverride === true) return true;
  if (charge.manualOverride === false) return false;
  return Boolean(charge.updatedBy);
}

async function deleteRefsInChunks(refs) {
  for (let index = 0; index < refs.length; index += 400) {
    const batch = writeBatch(db);
    for (const ref of refs.slice(index, index + 400)) batch.delete(ref);
    await batch.commit();
  }
}

export function subscribeStaff(orgId, callback, onError) {
  return onSnapshot(
    orgCollection(orgId, 'staff'),
    (snapshot) => callback(sorted(mapSnapshot(snapshot), 'displayName')),
    onError
  );
}

export async function saveStaffProfile(orgId, values) {
  const uid = values.uid.trim();
  const data = {
    uid,
    orgId,
    email: values.email.trim(),
    displayName: values.displayName.trim(),
    role: values.role,
    active: true,
    removedFromOrg: false,
    updatedAt: serverTimestamp(),
  };

  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid), { ...data, createdAt: serverTimestamp() }, { merge: true });
  batch.set(orgDocument(orgId, 'staff', uid), { ...data, createdAt: serverTimestamp() }, { merge: true });
  await batch.commit();
}

export async function setStaffActive(orgId, uid, active) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uid), { active, updatedAt: serverTimestamp() });
  batch.update(orgDocument(orgId, 'staff', uid), { active, updatedAt: serverTimestamp() });
  await batch.commit();
}

export async function removeStaffMember(orgId, member, actorUid) {
  const assignedGroups = await getDocs(query(orgCollection(orgId, 'groups'), where('coachId', '==', member.uid)));
  if (!assignedGroups.empty) {
    const error = new Error('coach-has-groups');
    error.code = 'coach-has-groups';
    error.groupNames = assignedGroups.docs.map((item) => item.data().name).filter(Boolean);
    throw error;
  }

  const batch = writeBatch(db);
  batch.set(doc(db, 'users', member.uid), {
    uid: member.uid,
    orgId,
    email: member.email || '',
    displayName: member.displayName || '',
    role: member.role || 'coach',
    active: false,
    removedFromOrg: true,
    removedBy: actorUid,
    removedAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  batch.delete(orgDocument(orgId, 'staff', member.uid));
  await batch.commit();
}

export function subscribeGroups(orgId, profile, callback, onError) {
  const base = orgCollection(orgId, 'groups');
  const source = profile.role === 'coach' ? query(base, where('coachId', '==', profile.uid)) : base;
  return onSnapshot(
    source,
    (snapshot) => callback(sorted(mapSnapshot(snapshot), 'name')),
    onError
  );
}

export async function createGroup(orgId, values, actorUid) {
  const ref = doc(orgCollection(orgId, 'groups'));
  await setDoc(ref, {
    ...values,
    id: ref.id,
    createdBy: actorUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateGroup(orgId, groupId, values, actorUid) {
  await updateDoc(orgDocument(orgId, 'groups', groupId), {
    ...values,
    updatedBy: actorUid,
    updatedAt: serverTimestamp(),
  });
}

export function subscribeGroup(orgId, groupId, callback, onError) {
  return onSnapshot(
    orgDocument(orgId, 'groups', groupId),
    (snapshot) => callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    onError
  );
}

export function subscribeChildren(orgId, callback, onError) {
  return onSnapshot(
    orgCollection(orgId, 'children'),
    (snapshot) => callback(sorted(mapSnapshot(snapshot), 'childName')),
    onError
  );
}

export async function createChild(orgId, values, actorUid) {
  const ref = doc(orgCollection(orgId, 'children'));
  await setDoc(ref, {
    ...values,
    id: ref.id,
    active: true,
    createdBy: actorUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateChild(orgId, childId, values, actorUid) {
  await updateDoc(orgDocument(orgId, 'children', childId), {
    ...values,
    updatedBy: actorUid,
    updatedAt: serverTimestamp(),
  });
}

export async function setChildActive(orgId, childId, active, actorUid) {
  await updateChild(orgId, childId, { active }, actorUid);
}

export async function deleteChildAndOperationalData(orgId, childId) {
  const [enrollmentsSnapshot, chargesSnapshot] = await Promise.all([
    getDocs(query(orgCollection(orgId, 'enrollments'), where('childId', '==', childId))),
    getDocs(query(orgCollection(orgId, 'charges'), where('childId', '==', childId))),
  ]);

  const relatedRefs = [
    ...chargesSnapshot.docs.map((item) => item.ref),
    ...enrollmentsSnapshot.docs.map((item) => item.ref),
  ];
  await deleteRefsInChunks(relatedRefs);

  const batch = writeBatch(db);
  batch.delete(orgDocument(orgId, 'children', childId));
  await batch.commit();

  return {
    enrollmentsDeleted: enrollmentsSnapshot.size,
    chargesDeleted: chargesSnapshot.size,
  };
}

export function subscribeEnrollments(orgId, callback, onError, groupId = null) {
  const base = orgCollection(orgId, 'enrollments');
  const source = groupId ? query(base, where('groupId', '==', groupId)) : base;
  return onSnapshot(
    source,
    (snapshot) => callback(sorted(mapSnapshot(snapshot), 'childName')),
    onError
  );
}

export async function createEnrollment(orgId, values, actorUid) {
  const ref = doc(orgCollection(orgId, 'enrollments'));
  const {
    initialStatus = 'active',
    initialPaymentStatus = 'unpaid',
    initialAmountPaid = 0,
    monthlyPaymentDefault: requestedMonthlyDefault,
    ...enrollmentValues
  } = values;
  const statusHistory = [
    {
      fromMonth: values.startMonth,
      status: initialStatus,
      reason: 'רישום ראשוני',
      changedAt: new Date().toISOString(),
      changedBy: actorUid,
    },
  ];

  const recurringMethod = isRecurringPaymentMethod(values.paymentMethod);
  const monthlyPaymentDefault = recurringMethod
    ? (requestedMonthlyDefault === 'unpaid' ? 'unpaid' : requestedMonthlyDefault === 'paid' ? 'paid' : initialPaymentStatus === 'paid' ? 'paid' : 'unpaid')
    : 'unpaid';
  const amount = ['exempt', 'no_charge'].includes(initialPaymentStatus)
    ? 0
    : Number(values.finalPrice || 0);
  const amountPaid = initialPaymentStatus === 'paid'
    ? amount
    : initialPaymentStatus === 'partial'
      ? Math.min(Math.max(Number(initialAmountPaid || 0), 0), amount)
      : 0;
  const chargeId = `${values.startMonth}_${ref.id}`;
  const batch = writeBatch(db);

  batch.set(ref, {
    ...enrollmentValues,
    id: ref.id,
    currentStatus: initialStatus,
    statusHistory,
    initialPaymentStatus,
    monthlyPaymentDefault,
    createdBy: actorUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(orgDocument(orgId, 'charges', chargeId), {
    id: chargeId,
    month: values.startMonth,
    enrollmentId: ref.id,
    childId: values.childId,
    childName: values.childName,
    parentName: values.parentName || '',
    parentPhone: values.parentPhone || '',
    parentEmail: values.parentEmail || '',
    groupId: values.groupId,
    groupName: values.groupName,
    coachId: values.coachId || '',
    coachName: values.coachName || '',
    amount,
    originalAmount: Number(values.basePrice || 0),
    discountPercent: Number(values.discountPercent || 0),
    amountPaid,
    status: initialPaymentStatus,
    activityStatus: initialStatus,
    paymentMethod: values.paymentMethod,
    paymentMethodNote: values.paymentMethodNote || '',
    monthlyPaymentDefault,
    manualOverride: initialPaymentStatus !== monthlyPaymentDefault,
    checkDeposited: values.paymentMethod === 'checks' ? false : null,
    note: 'נוצר בעת הרישום לקבוצה',
    generatedBy: actorUid,
    ...(initialPaymentStatus === 'paid' ? { paidAt: new Date().toISOString() } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  return ref.id;
}

export async function updateEnrollment(orgId, enrollmentId, values, actorUid) {
  const payload = { ...values };
  if (payload.paymentMethod === 'other') payload.monthlyPaymentDefault = 'unpaid';
  await updateDoc(orgDocument(orgId, 'enrollments', enrollmentId), {
    ...payload,
    updatedBy: actorUid,
    updatedAt: serverTimestamp(),
  });
}

export async function changeEnrollmentStatus(orgId, enrollment, { status, fromMonth, reason }, actorUid) {
  const nextHistory = [
    ...(enrollment.statusHistory || []),
    {
      fromMonth,
      status,
      reason: reason?.trim() || '',
      changedAt: new Date().toISOString(),
      changedBy: actorUid,
    },
  ];

  await updateEnrollment(
    orgId,
    enrollment.id,
    {
      currentStatus: status,
      statusHistory: nextHistory,
      ...(status === 'ended' ? { endMonth: fromMonth } : {}),
    },
    actorUid
  );
}

export function subscribeCharges(orgId, month, callback, onError) {
  const source = query(orgCollection(orgId, 'charges'), where('month', '==', month));
  return onSnapshot(
    source,
    (snapshot) => callback(sorted(mapSnapshot(snapshot), 'childName')),
    onError
  );
}

export async function generateChargesForMonth(orgId, month, actorUid) {
  const [enrollmentSnapshot, existingChargesSnapshot] = await Promise.all([
    getDocs(orgCollection(orgId, 'enrollments')),
    getDocs(query(orgCollection(orgId, 'charges'), where('month', '==', month))),
  ]);
  const enrollments = mapSnapshot(enrollmentSnapshot);
  const existingMap = new Map(existingChargesSnapshot.docs.map((item) => [item.id, { id: item.id, ...item.data() }]));
  const candidates = enrollments.filter((item) => isMonthInRange(month, item.startMonth, item.endMonth));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const operations = [];

  for (const enrollment of candidates) {
    const chargeId = `${month}_${enrollment.id}`;
    const existingCharge = existingMap.get(chargeId);
    const desired = buildMonthlyChargeState(enrollment, month);

    if (existingCharge) {
      const legacyExplicitInitialPayment = (
        existingCharge.manualOverride == null
        && !existingCharge.updatedBy
        && existingCharge.month === enrollment.startMonth
        && existingCharge.note === 'נוצר בעת הרישום לקבוצה'
        && existingCharge.status !== desired.status
      );
      if (hasManualChargeOverride(existingCharge) || legacyExplicitInitialPayment) {
        skipped += 1;
        continue;
      }

      const needsUpdate = (
        Number(existingCharge.amount || 0) !== desired.amount
        || Number(existingCharge.amountPaid || 0) !== desired.amountPaid
        || existingCharge.status !== desired.status
        || existingCharge.activityStatus !== desired.activityStatus
        || existingCharge.paymentMethod !== enrollment.paymentMethod
        || existingCharge.monthlyPaymentDefault !== desired.monthlyPaymentDefault
        || existingCharge.childName !== enrollment.childName
        || existingCharge.groupName !== enrollment.groupName
        || existingCharge.coachId !== (enrollment.coachId || '')
      );

      if (!needsUpdate) {
        skipped += 1;
        continue;
      }

      operations.push({
        type: 'merge',
        ref: orgDocument(orgId, 'charges', chargeId),
        data: {
          childName: enrollment.childName,
          parentName: enrollment.parentName || '',
          parentPhone: enrollment.parentPhone || '',
          parentEmail: enrollment.parentEmail || '',
          groupName: enrollment.groupName,
          coachId: enrollment.coachId || '',
          coachName: enrollment.coachName || '',
          amount: desired.amount,
          originalAmount: Number(enrollment.basePrice || 0),
          discountPercent: Number(enrollment.discountPercent || 0),
          amountPaid: desired.amountPaid,
          status: desired.status,
          activityStatus: desired.activityStatus,
          paymentMethod: enrollment.paymentMethod,
          paymentMethodNote: enrollment.paymentMethodNote || '',
          monthlyPaymentDefault: desired.monthlyPaymentDefault,
          manualOverride: false,
          ...(enrollment.paymentMethod === 'checks' && existingCharge.checkDeposited == null ? { checkDeposited: false } : {}),
          ...(desired.status === 'paid' && !existingCharge.paidAt ? { paidAt: new Date().toISOString() } : {}),
          ...(desired.status !== 'paid' ? { paidAt: deleteField() } : {}),
          synchronizedBy: actorUid,
          updatedAt: serverTimestamp(),
        },
      });
      continue;
    }

    operations.push({
      type: 'create',
      ref: orgDocument(orgId, 'charges', chargeId),
      data: {
        id: chargeId,
        month,
        enrollmentId: enrollment.id,
        childId: enrollment.childId,
        childName: enrollment.childName,
        parentName: enrollment.parentName || '',
        parentPhone: enrollment.parentPhone || '',
        parentEmail: enrollment.parentEmail || '',
        groupId: enrollment.groupId,
        groupName: enrollment.groupName,
        coachId: enrollment.coachId || '',
        coachName: enrollment.coachName || '',
        amount: desired.amount,
        originalAmount: Number(enrollment.basePrice || 0),
        discountPercent: Number(enrollment.discountPercent || 0),
        amountPaid: desired.amountPaid,
        status: desired.status,
        activityStatus: desired.activityStatus,
        paymentMethod: enrollment.paymentMethod,
        paymentMethodNote: enrollment.paymentMethodNote || '',
        monthlyPaymentDefault: desired.monthlyPaymentDefault,
        manualOverride: false,
        checkDeposited: enrollment.paymentMethod === 'checks' ? false : null,
        note: '',
        generatedBy: actorUid,
        ...(desired.status === 'paid' ? { paidAt: new Date().toISOString() } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    });
  }

  for (let index = 0; index < operations.length; index += 400) {
    const batch = writeBatch(db);
    for (const operation of operations.slice(index, index + 400)) {
      if (operation.type === 'merge') batch.set(operation.ref, operation.data, { merge: true });
      else batch.set(operation.ref, operation.data);
      if (operation.type === 'create') created += 1;
      else updated += 1;
    }
    await batch.commit();
  }

  return { created, updated, skipped };
}

export async function updateCharge(orgId, chargeId, values, actorUid) {
  const payload = {
    ...values,
    manualOverride: true,
    updatedBy: actorUid,
    updatedAt: serverTimestamp(),
  };
  if (values.status === 'paid' && !values.paidAt) payload.paidAt = new Date().toISOString();
  if (values.status !== 'paid' && values.status !== 'partial') payload.paidAt = deleteField();
  if (values.checkDeposited === false) {
    payload.checkDepositedAt = deleteField();
    payload.checkDepositedBy = deleteField();
  }
  await updateDoc(orgDocument(orgId, 'charges', chargeId), payload);
}

export async function setCheckDeposited(orgId, charge, deposited, actorUid) {
  const manualOverride = charge.manualOverride === true
    || (charge.manualOverride == null && Boolean(charge.updatedBy));
  await updateDoc(orgDocument(orgId, 'charges', charge.id), {
    checkDeposited: deposited,
    manualOverride,
    ...(deposited
      ? { checkDepositedAt: new Date().toISOString(), checkDepositedBy: actorUid }
      : { checkDepositedAt: deleteField(), checkDepositedBy: deleteField() }),
    updatedAt: serverTimestamp(),
  });
}

export async function resetChargeToMonthlyDefault(orgId, charge, enrollment, actorUid) {
  if (!enrollment) throw new Error('enrollment-not-found');
  const desired = buildMonthlyChargeState(enrollment, charge.month);
  await updateDoc(orgDocument(orgId, 'charges', charge.id), {
    amount: desired.amount,
    amountPaid: desired.amountPaid,
    status: desired.status,
    activityStatus: desired.activityStatus,
    paymentMethod: enrollment.paymentMethod,
    paymentMethodNote: enrollment.paymentMethodNote || '',
    monthlyPaymentDefault: desired.monthlyPaymentDefault,
    manualOverride: false,
    note: '',
    ...(desired.status === 'paid' ? { paidAt: new Date().toISOString() } : { paidAt: deleteField() }),
    resetBy: actorUid,
    resetAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });
}

export async function ensureSession(orgId, group, date, actorUid) {
  const sessionId = `${group.id}_${date}`;
  const sessionRef = orgDocument(orgId, 'sessions', sessionId);
  const enrollmentQuery = query(orgCollection(orgId, 'enrollments'), where('groupId', '==', group.id));
  const [existing, enrollmentSnapshot] = await Promise.all([
    getDoc(sessionRef),
    getDocs(enrollmentQuery),
  ]);

  const month = date.slice(0, 7);
  const relevantEnrollments = mapSnapshot(enrollmentSnapshot).filter((item) => {
    const status = getStatusForMonth(item.statusHistory, month);
    return isMonthInRange(month, item.startMonth, item.endMonth) && ['active', 'no_charge'].includes(status);
  });

  const existingData = existing.exists() ? { id: existing.id, ...existing.data() } : null;
  const attendance = { ...(existingData?.attendance || {}) };
  let attendanceChanged = false;

  for (const enrollment of relevantEnrollments) {
    if (attendance[enrollment.childId]) continue;
    attendance[enrollment.childId] = {
      childId: enrollment.childId,
      childName: enrollment.childName,
      parentName: enrollment.parentName || '',
      parentPhone: enrollment.parentPhone || '',
      status: 'present',
      note: '',
      updatedAt: new Date().toISOString(),
      updatedBy: actorUid,
    };
    attendanceChanged = true;
  }

  if (existingData) {
    if (attendanceChanged) {
      await updateDoc(sessionRef, {
        attendance,
        updatedBy: actorUid,
        updatedAt: serverTimestamp(),
      });
    }
    return { ...existingData, attendance };
  }

  const slot = (group.schedule || []).find((item) => Number(item.dayOfWeek) === new Date(`${date}T12:00:00`).getDay());
  const data = {
    id: sessionId,
    date,
    groupId: group.id,
    groupName: group.name,
    coachId: group.coachId,
    coachName: group.coachName,
    startTime: slot?.startTime || '',
    endTime: slot?.endTime || '',
    cancelled: false,
    attendance,
    createdBy: actorUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(sessionRef, data);
  return data;
}

export function subscribeSession(orgId, groupId, date, callback, onError) {
  const sessionId = `${groupId}_${date}`;
  return onSnapshot(
    orgDocument(orgId, 'sessions', sessionId),
    (snapshot) => callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    onError
  );
}

export async function saveSessionAttendance(orgId, session, attendance, actorUid) {
  await updateDoc(orgDocument(orgId, 'sessions', session.id), {
    attendance,
    updatedBy: actorUid,
    updatedAt: serverTimestamp(),
  });
}

export async function setSessionCancelled(orgId, sessionId, cancelled, actorUid) {
  await updateDoc(orgDocument(orgId, 'sessions', sessionId), {
    cancelled,
    updatedBy: actorUid,
    updatedAt: serverTimestamp(),
  });
}
