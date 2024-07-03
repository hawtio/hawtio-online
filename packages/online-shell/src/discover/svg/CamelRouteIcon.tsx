import routeImg from './camel-route.svg'

type CamelImageIconProps = {
  size?: number
}

export const CamelRouteIcon = (props: CamelImageIconProps) => {
  const { size = 16 } = props
  return <img src={routeImg} width={size + 'px'} height={size + 'px'} alt='camel-route' />
}
