//Used by dynamo.ts
import * as process from 'process';
import { createGetMandatoryParameter } from './parameters';

export const AwsRegion = process.env['AWS_REGION'];
export const indexTableName = process.env['INDEX_TABLE'];
export const lastUpdatedIndex = process.env['LAST_UPDATED_INDEX'];

//Used by fastly.ts
const UrlPrefix = /^http(s)?:\/\//;
export const getContentUrlBase =
	createGetMandatoryParameter('CONTENT_URL_BASE');
export const getContentPrefix = () => {
	const contentUrlBase = getContentUrlBase();

	if (contentUrlBase === '') {
		throw new Error(
			'Attempted to create content prefix, but CONTENT_URL_BASE is an empty string.',
		);
	}
	return contentUrlBase.replace(UrlPrefix, '');
};
export const DebugLogsEnabled = process.env['DEBUG_LOGS']
	? process.env['DEBUG_LOGS'].toLowerCase() === 'true'
	: false;
export const MaximumRetries = process.env['MAX_RETRIES']
	? parseInt(process.env['MAX_RETRIES'])
	: 10;
export const RetryDelaySeconds = process.env['RETRY_DELAY']
	? parseInt(process.env['RETRY_DELAY'])
	: 1;
export const getFastlyApiKey = createGetMandatoryParameter('FASTLY_API_KEY');

//Used by s3.ts
export const getStaticBucketName = createGetMandatoryParameter('STATIC_BUCKET');

export const getCapiBaseUrl = createGetMandatoryParameter('CAPI_BASE_URL');

//Used by telemetry
export const TelemetryXAR = process.env['TELEMETRY_XAR'];
export const TelemetryTopic = process.env['TELEMETRY_TOPIC'];

//Used by content transforms
export const PreviewImageWidth = process.env['PREVIEW_IMAGE_WIDTH']
	? parseInt(process.env['PREVIEW_IMAGE_WIDTH'])
	: 1600;
export const FeaturedImageWidth = process.env['FEATURED_IMAGE_WIDTH']
	? parseInt(process.env['FEATURED_IMAGE_WIDTH'])
	: 1600;
export const ImageDpr = process.env['IMAGE_DPR']
	? parseInt(process.env['IMAGE_DPR'])
	: 1;

//Used by eventbus
export const getOutgoingEventBus =
	createGetMandatoryParameter('OUTGOING_EVENT_BUS');
