export class CapabilityUnavailableError extends Error {
 readonly statusCode=501;readonly code='CAPABILITY_NOT_IMPLEMENTED';
 constructor(message:string){super(message);this.name='CapabilityUnavailableError';}
}
