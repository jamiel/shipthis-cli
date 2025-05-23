import {useEffect, useState} from 'react'
import {Box, Text} from 'ink'
import {DateTime} from 'luxon'
import Spinner from 'ink-spinner'

import {getJobStatusColor, getJobSummary, getStageColor} from '@cli/utils/index.js'
import {Job, JobStatus} from '@cli/types'
import {useJobWatching} from '@cli/utils/hooks/index.js'
import {Title} from './common/Title.js'
import {StatusRow, StatusRowLabel} from './common/StatusTable.js'

interface JobStatusTableProps {
  projectId: string
  jobId: string
  isWatching: boolean
  onJobUpdate?: (job: Job) => void
}

const JobStatusSpinner = ({status, showSpinner}: {status: JobStatus; showSpinner: boolean}) => (
  <>
    <Box width={JobStatus.PROCESSING.length}>
      <Text color={getJobStatusColor(status)}>{`${status}`}</Text>
    </Box>
    {showSpinner && (
      <>
        <Text> </Text>
        <Spinner type="dots" />
      </>
    )}
  </>
)

export const JobStatusTable = ({jobId, projectId, isWatching, onJobUpdate}: JobStatusTableProps) => {
  const {data: job, stage, isLoading} = useJobWatching({projectId, jobId, isWatching, onJobUpdate})

  const [time, setTime] = useState(DateTime.now())

  useEffect(() => {
    if (!isWatching) return
    const interval = setInterval(() => setTime(DateTime.now()), 1000)
    return () => {
      clearInterval(interval)
    }
  }, [])

  const isJobInProgress = job && ![JobStatus.COMPLETED, JobStatus.FAILED].includes(job.status)
  const summary = job ? getJobSummary(job, time) : null

  return (
    <Box flexDirection="row">
      <Box flexDirection="column" marginBottom={1}>
        <Title>Job Details</Title>
        {isLoading && <Spinner type="dots" />}
        {summary && job && (
          <Box flexDirection="row">
            <Box flexDirection="column" marginLeft={2}>
              <StatusRow label="ID" value={summary.id} />
              <StatusRow label="Platform" value={summary.platform} />
              <Box flexDirection="row">
                <StatusRowLabel label="Status" />
                <JobStatusSpinner status={job.status} showSpinner={isWatching && !!isJobInProgress} />
              </Box>
              <Box flexDirection="row">
                <StatusRowLabel label="Stage" />
                {stage && <Text color={getStageColor(stage)}>{`${stage}`}</Text>}
              </Box>
            </Box>
            <Box flexDirection="column" marginLeft={2}>
              <StatusRow label="Version" value={summary.version} />
              <StatusRow label="Git Info" value={summary.gitInfo} />
              <StatusRow label="Started At" value={summary.createdAt} />
              <StatusRow label="Runtime" value={summary.runtime} />
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  )
}
