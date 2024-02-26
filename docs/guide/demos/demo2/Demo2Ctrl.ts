import { ControllerBaseProxy } from 'bizify';

type DemoPageData = {
  val: number;
};

export class Demo2Ctrl extends ControllerBaseProxy<DemoPageData> {
  $data(): DemoPageData {
    return { val: 1 };
  }

  // 注意用箭头函数
  plus = () => {
    this.data.val += 1;
  };
}
