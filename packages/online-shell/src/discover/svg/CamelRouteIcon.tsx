import routeImg from './camel-route.svg'

type CamelImageIconProps = {
  size: number
} & typeof defaultImageIconProps

const defaultImageIconProps = {
  size: 16,
}

export const CamelRouteIcon = (props: CamelImageIconProps) => {
  return <img src={routeImg} width={props.size + 'px'} height={props.size + 'px'} alt='camel-route' />
}

CamelRouteIcon.defaultProps = defaultImageIconProps
