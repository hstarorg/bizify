import { ControllerBaseProxy } from 'bizify';

type DemoPageData = {
  val: number;
};

function mockRequest(userId: string): any {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({ userId: userId, userName: 'Hi' });
    }, 500);
  });
}

export class DemoCtrl extends ControllerBaseProxy<DemoPageData> {
  $data(): DemoPageData {
    return { val: 1 };
  }

  getUserDetail = () => {
    const { testApi } = this.services;
    testApi.execute('001');
  };

  services = {
    testApi: this.$buildService(mockRequest),
  };
}
