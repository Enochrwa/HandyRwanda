import 'lucide-react-native';
import { SvgProps } from 'react-native-svg';
import { ColorValue } from 'react-native';

declare module 'lucide-react-native' {
  export interface LucideProps extends SvgProps {
    size?: number | string;
    color?: string | ColorValue;
    absoluteStrokeWidth?: boolean;
    fill?: string | ColorValue;
  }
}
