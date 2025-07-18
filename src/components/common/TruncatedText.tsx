import {Box, Text, TextProps, measureElement} from 'ink'
import {useEffect, useRef, useState} from 'react'
import stringLength from 'string-length'
import stripAnsi from 'strip-ansi'

interface Props extends TextProps {
  children: string
}

// Was having some issues with <Text wrap="truncate" />
export const TruncatedText = ({children, wrap, ...textPropsWithoutWrap}: Props) => {
  const ref = useRef()

  const [width, setWidth] = useState<null | number>(null)

  useEffect(() => {
    if (!ref.current) return
    const {width: measuredWidth} = measureElement(ref.current)
    setWidth(measuredWidth)
  }, [])

  // TODO: still not perfect as things get cut off earlier in the JobLogTail component?
  const getTruncated = (input: string) => {
    const withoutCrlf = input.replaceAll(/[\n\r]/g, '')
    if (width === null) return withoutCrlf
    const withoutAnsi = stripAnsi(withoutCrlf)
    const textLength = stringLength(withoutAnsi)
    return textLength > width ? withoutCrlf.slice(0, Math.max(0, width)) : withoutCrlf
  }

  return (
    <Box ref={ref as any}>
      <Text {...textPropsWithoutWrap}>{getTruncated(children) + '\u001B[0m'}</Text>
    </Box>
  )
}
