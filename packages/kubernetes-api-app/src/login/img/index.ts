import { BackgroundImageSrcMap } from '@patternfly/react-core'
import hawtioLogo from './hawtio-logo.svg'
import userAvatar from './img_avatar.svg'
import backgroundImageSrcLg from './pfbg_1200.jpg'
import backgroundImageSrcXs from './pfbg_576.jpg'
import backgroundImageSrcXs2x from './pfbg_576@2x.jpg'
import backgroundImageSrcSm from './pfbg_768.jpg'
import backgroundImageSrcSm2x from './pfbg_768@2x.jpg'

export const backgroundImages: BackgroundImageSrcMap = {
  xs: backgroundImageSrcXs,
  xs2x: backgroundImageSrcXs2x,
  sm: backgroundImageSrcSm,
  sm2x: backgroundImageSrcSm2x,
  lg: backgroundImageSrcLg,
}

export { hawtioLogo, userAvatar }
