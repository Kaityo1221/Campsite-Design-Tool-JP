/*
 * Explicit Creative portable ZIP -> isolated Campsite Distance candidate.
 * LAB-ONLY receive/inspect/confirm/isolated-store/reopen. Not the production
 * Campsite Project importer, not a production Distance write path.
 *
 * Commit is CREATE-ONLY. Even on explicit user confirmation it NEVER
 * overwrites another stored Project revision: no irreversible auto rollback.
 * Two tabs racing for the same absent key are arbitrated by real IDB CAS.
 */
import {createX01IndexedDbSaveLab} from './x01-indexeddb-save-lab.mjs';
import {inspectPortableReturnBundleLab} from './portable-return-bundle-lab.mjs';
import {inspectCampsiteDistanceReturnStageLab} from './campsite-distance-return-stage-lab.mjs';
import {previewDistanceCalculationLab} from './campsite-distance-math-preview-lab.mjs';

export const DISTANCE_RECEIVER_LAB_DB='campsite-creative-next-x01-idb-lab-distance-receiver-20261016';
const stop=code=>{const e=new Error(code);e.code=code;throw e;};
const valid=x=>typeof x==='string'&&x.trim().length>0&&x.length<=128;

export function createCampsiteDistanceConfirmedImportLab({
 indexedDB=globalThis.indexedDB,dbName=DISTANCE_RECEIVER_LAB_DB,
 JSZip,DOMParser,cryptoProvider=globalThis.crypto
}={}){
 const saved=createX01IndexedDbSaveLab({indexedDB,dbName,JSZip,DOMParser,cryptoProvider});
 const deps={JSZip,DOMParser,cryptoProvider};
 let pending=null,serial=0;
 async function verify(data){
  const p=await inspectCampsiteDistanceReturnStageLab({...data,...deps});
  const v=previewDistanceCalculationLab(p,{
   referencePois:data.project.wayfarerObservation.zones.reference100});
  if(p.productionReady!==false||p.legacyDistanceCommitAllowed!==false||
    v.productionReady!==false||v.realDistanceResult!==false)stop('DISTANCE_LAB_GATE');
  return {stage:p,preview:v};
 }
 const prepare=async({bytes,expectedProjectId,expectedHandoffId}={})=>{
  // Every attempted new preview invalidates any previous confirmation ticket.
  pending=null;serial++;
  if(!valid(expectedProjectId)||!valid(expectedHandoffId))stop('DISTANCE_IMPORT_IDS_REQUIRED');
  const received=await inspectPortableReturnBundleLab({
   bytes,expectedProjectId,expectedHandoffId,...deps
  });
  const {stage,preview}=await verify({
   project:received.project,activityAreas:received.activityAreas,
   kmzBytes:received.kmzBytes,expectedProjectId,expectedHandoffId
  });
  const existing=await saved.read({expectedProjectId,expectedHandoffId});
  const ticket=serial;
  pending={ticket,project:received.project,activityAreas:received.activityAreas,
   kmzBytes:new Uint8Array(received.kmzBytes),
   expectedProjectId,expectedHandoffId,
   existingRevision:existing?.revision||0,
   sourceRevision:received.revision};
  return Object.freeze({
   status:'DISTANCE_LAB_AWAIT_EXPLICIT_CONFIRMATION',ticket,
   sourceRevision:received.revision,existingRevision:pending.existingRevision,
   canCreate:pending.existingRevision===0,
   productionReady:false,writeAllowed:false,
   transportAuthenticated:false,producerIdentityVerified:false,
   summary:stage.summary,distanceSummary:preview.summary,
   // Read-only, verified snapshot. This is NOT a mapping grant.
   x01Stage:stage
  });
 };
 const confirmCreate=async({ticket,confirmed}={})=>{
  if(!pending||ticket!==pending.ticket)stop('DISTANCE_IMPORT_TICKET_STALE');
  if(confirmed!==true)stop('DISTANCE_IMPORT_CONSENT_REQUIRED');
  const data=pending;pending=null;
  if(data.existingRevision!==0)stop('DISTANCE_IMPORT_EXISTING_PROTECTED');
  // Re-verify from the complete receipt *before* opening a write transaction.
  await verify(data);
  const plan={
   status:'LAB_GEOMETRY_PLAN_READY',productionReady:false,
   projectId:data.expectedProjectId,handoffId:data.expectedHandoffId,
   project:data.project,activityAreas:data.activityAreas
  };
  const result=await saved.save({
   plan,kmzBytes:data.kmzBytes,expectedProjectId:data.expectedProjectId,
   expectedHandoffId:data.expectedHandoffId,expectedRevision:0
  });
  return Object.freeze({status:'DISTANCE_LAB_ISOLATED_SAVE_VERIFIED',
   revision:result.revision,productionReady:false,productionProjectWritten:false});
 };
 const reopen=async({expectedProjectId,expectedHandoffId}={})=>{
  if(!valid(expectedProjectId)||!valid(expectedHandoffId))stop('DISTANCE_IMPORT_IDS_REQUIRED');
  const row=await saved.read({expectedProjectId,expectedHandoffId});
  if(!row)stop('DISTANCE_IMPORT_SAVED_NOT_FOUND');
  const {stage,preview}=await verify({
   project:row.project,activityAreas:row.activityAreas,kmzBytes:row.kmzBytes,
   expectedProjectId,expectedHandoffId
  });
  return Object.freeze({
   status:'DISTANCE_LAB_REOPEN_VERIFIED',revision:row.revision,
   project:row.project,activityAreas:row.activityAreas,
   kmzBytes:new Uint8Array(row.kmzBytes),
   summary:stage.summary,distanceSummary:preview.summary,
   x01Stage:stage,
   productionReady:false,writeAllowed:false
  });
 };
 return Object.freeze({
  dbName,productionReady:false,productionProjectWritten:false,
  prepare,confirmCreate,reopen
 });
}
